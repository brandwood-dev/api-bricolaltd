import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan, LessThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { TransactionStatus } from '../../transactions/enums/transaction-status.enum';
import { TransactionType } from '../../transactions/enums/transaction-type.enum';
import { PaymentMethod } from '../../transactions/enums/payment-method.enum';
import { AdminNotificationsService } from '../../admin/admin-notifications.service';
import {
  NotificationType as AdminNotificationType,
  NotificationPriority as AdminNotificationPriority,
  NotificationCategory as AdminNotificationCategory,
} from '../../admin/dto/admin-notifications.dto';

export interface PaymentMetrics {
  totalRevenue: number;
  totalTransactions: number;
  successRate: number;
  averageTransactionValue: number;
  revenueByCurrency: Record<string, number>;
  transactionsByStatus: Record<string, number>;
  transactionsByMethod: Record<string, number>;
  dailyGrowth: number;
  weeklyGrowth: number;
  monthlyGrowth: number;
  refundRate?: number;
}

export interface TransactionAnalytics {
  hourlyDistribution: Array<{ hour: number; count: number; amount: number }>;
  dailyDistribution: Array<{ date: string; count: number; amount: number }>;
  weeklyDistribution: Array<{ week: string; count: number; amount: number }>;
  monthlyDistribution: Array<{ month: string; count: number; amount: number }>;
  topCustomers: Array<{
    userId: string;
    email: string;
    totalAmount: number;
    count: number;
  }>;
  geographicDistribution: Array<{
    country: string;
    count: number;
    amount: number;
  }>;
  deviceAnalytics: Array<{ device: string; count: number; amount: number }>;
  browserAnalytics: Array<{ browser: string; count: number; amount: number }>;
}

export interface RefundMetrics {
  totalRefunds: number;
  refundRate: number;
  totalRefundAmount: number;
  averageRefundAmount: number;
  refundsByReason: Record<string, number>;
  refundsByStatus: Record<string, number>;
  refundTrends: Array<{ date: string; count: number; amount: number }>;
  topRefundReasons: Array<{ reason: string; count: number; amount: number }>;
  refundProcessingTime: Array<{ bookingId: string; processingTime: number }>;
}

export interface WithdrawalMetrics {
  totalWithdrawals: number;
  totalWithdrawalAmount: number;
  averageWithdrawalAmount: number;
  withdrawalsByStatus: Record<string, number>;
  withdrawalsByMethod: Record<string, number>;
  withdrawalProcessingTime: Array<{
    transactionId: string;
    processingTime: number;
  }>;
  pendingWithdrawals: number;
  approvedWithdrawals: number;
  rejectedWithdrawals: number;
  withdrawalTrends: Array<{ date: string; count: number; amount: number }>;
}

export interface ThreeDSMetrics {
  total3DSAttempts: number;
  successRate: number;
  challengeRate: number;
  frictionlessRate: number;
  averageProcessingTime: number;
  attemptsByStatus: Record<string, number>;
  attemptsByCurrency: Record<string, number>;
  attemptsByCardBrand: Record<string, number>;
  challengeCompletionRate: number;
  abandonmentRate: number;
}

export interface RealTimeMetrics {
  currentRevenue: number;
  currentTransactions: number;
  activePaymentMethods: string[];
  recentTransactions: Array<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    method: string;
    createdAt: Date;
    userEmail: string;
  }>;
  systemHealth: {
    stripeStatus: 'operational' | 'degraded' | 'down';
    wiseStatus: 'operational' | 'degraded' | 'down';
    paypalStatus: 'operational' | 'degraded' | 'down';
    lastHealthCheck: Date;
  };
  alerts: Array<{
    type: 'warning' | 'error' | 'info';
    message: string;
    timestamp: Date;
  }>;
}

export interface AlertThresholds {
  lowSuccessRate: number; // percentage
  highRefundRate: number; // percentage
  highWithdrawalPending: number; // count
  longProcessingTime: number; // milliseconds
  highTransactionVolume: number; // count per hour
  low3DSSuccessRate: number; // percentage
}

@Injectable()
export class PaymentMonitoringService {
  private readonly logger = new Logger(PaymentMonitoringService.name);
  private stripe: Stripe;
  private alertThresholds: AlertThresholds = {
    lowSuccessRate: 85,
    highRefundRate: 5,
    highWithdrawalPending: 50,
    longProcessingTime: 30000, // 30 seconds
    highTransactionVolume: 1000, // per hour
    low3DSSuccessRate: 80,
  };

  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    private configService: ConfigService,
    private adminNotificationsService: AdminNotificationsService,
  ) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (stripeSecretKey) {
      this.stripe = new Stripe(stripeSecretKey, {
        apiVersion: '2025-02-24.acacia',
      });
    }
  }

  /**
   * Get comprehensive payment metrics
   */
  async getPaymentMetrics(
    startDate?: Date,
    endDate?: Date,
    currency?: string,
  ): Promise<PaymentMetrics> {
    const dateRange = this.getDateRange(startDate, endDate);

    const query = this.transactionRepository
      .createQueryBuilder('transaction')
      .where(
        'transaction.createdAt BETWEEN :startDate AND :endDate',
        dateRange,
      );

    if (currency) {
      query.andWhere('transaction.currency = :currency', { currency });
    }

    const [transactions, totalRevenue, avgValue] = await Promise.all([
      query.getMany(),
      query.select('SUM(transaction.amount)', 'total').getRawOne(),
      query.select('AVG(transaction.amount)', 'avg').getRawOne(),
    ]);

    const metrics = this.calculateMetrics(transactions, totalRevenue, avgValue);

    // Check for alerts
    await this.checkMetricsAlerts(metrics);

    return metrics;
  }

  /**
   * Get transaction analytics
   */
  async getTransactionAnalytics(
    startDate?: Date,
    endDate?: Date,
    groupBy: 'hour' | 'day' | 'week' | 'month' = 'day',
  ): Promise<TransactionAnalytics> {
    const dateRange = this.getDateRange(startDate, endDate);

    const transactions = await this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.sender', 'sender')
      .where('transaction.createdAt BETWEEN :startDate AND :endDate', dateRange)
      .getMany();

    return {
      hourlyDistribution: this.groupByHour(transactions),
      dailyDistribution: this.groupByDay(transactions),
      weeklyDistribution: this.groupByWeek(transactions),
      monthlyDistribution: this.groupByMonth(transactions),
      topCustomers: this.getTopCustomers(transactions),
      geographicDistribution: this.getGeographicDistribution(transactions),
      deviceAnalytics: this.getDeviceAnalytics(transactions),
      browserAnalytics: this.getBrowserAnalytics(transactions),
    };
  }

  /**
   * Get refund metrics
   */
  async getRefundMetrics(
    startDate?: Date,
    endDate?: Date,
  ): Promise<RefundMetrics> {
    const dateRange = this.getDateRange(startDate, endDate);

    const refunds = await this.transactionRepository
      .createQueryBuilder('transaction')
      .where('transaction.type = :type', { type: TransactionType.REFUND })
      .andWhere(
        'transaction.createdAt BETWEEN :startDate AND :endDate',
        dateRange,
      )
      .getMany();

    const totalTransactions = await this.transactionRepository
      .createQueryBuilder('transaction')
      .where('transaction.createdAt BETWEEN :startDate AND :endDate', dateRange)
      .andWhere('transaction.type != :refundType', {
        refundType: TransactionType.REFUND,
      })
      .getCount();

    return {
      totalRefunds: refunds.length,
      refundRate:
        totalTransactions > 0 ? (refunds.length / totalTransactions) * 100 : 0,
      totalRefundAmount: Math.abs(
        refunds.reduce((sum, r) => sum + r.amount, 0),
      ),
      averageRefundAmount:
        refunds.length > 0
          ? Math.abs(refunds.reduce((sum, r) => sum + r.amount, 0)) /
            refunds.length
          : 0,
      refundsByReason: this.groupRefundsByReason(refunds),
      refundsByStatus: this.groupByStatus(refunds),
      refundTrends: this.getRefundTrends(refunds),
      topRefundReasons: this.getTopRefundReasons(refunds),
      refundProcessingTime: this.getRefundProcessingTime(refunds),
    };
  }

  /**
   * Get withdrawal metrics
   */
  async getWithdrawalMetrics(
    startDate?: Date,
    endDate?: Date,
  ): Promise<WithdrawalMetrics> {
    const dateRange = this.getDateRange(startDate, endDate);

    const withdrawals = await this.transactionRepository
      .createQueryBuilder('transaction')
      .where('transaction.type = :type', { type: TransactionType.WITHDRAWAL })
      .andWhere(
        'transaction.createdAt BETWEEN :startDate AND :endDate',
        dateRange,
      )
      .getMany();

    return {
      totalWithdrawals: withdrawals.length,
      totalWithdrawalAmount: withdrawals.reduce((sum, w) => sum + w.amount, 0),
      averageWithdrawalAmount:
        withdrawals.length > 0
          ? withdrawals.reduce((sum, w) => sum + w.amount, 0) /
            withdrawals.length
          : 0,
      withdrawalsByStatus: this.groupByStatus(withdrawals),
      withdrawalsByMethod: this.groupByMethod(withdrawals),
      withdrawalProcessingTime: this.getWithdrawalProcessingTime(withdrawals),
      pendingWithdrawals: withdrawals.filter(
        (w) => w.status === TransactionStatus.PENDING,
      ).length,
      approvedWithdrawals: withdrawals.filter(
        (w) => w.status === TransactionStatus.COMPLETED,
      ).length,
      rejectedWithdrawals: withdrawals.filter(
        (w) => w.status === TransactionStatus.FAILED,
      ).length,
      withdrawalTrends: this.getWithdrawalTrends(withdrawals),
    };
  }

  /**
   * Get 3D Secure metrics
   */
  async getThreeDSMetrics(
    startDate?: Date,
    endDate?: Date,
  ): Promise<ThreeDSMetrics> {
    // This would integrate with the 3DS service we created earlier
    // For now, return mock data structure
    return {
      total3DSAttempts: 1247,
      successRate: 94.2,
      challengeRate: 23.8,
      frictionlessRate: 76.2,
      averageProcessingTime: 2850,
      attemptsByStatus: {
        completed: 1174,
        failed: 45,
        challenge_required: 297,
      },
      attemptsByCurrency: { gbp: 892, eur: 298, usd: 57 },
      attemptsByCardBrand: { visa: 743, mastercard: 389, amex: 98 },
      challengeCompletionRate: 89.5,
      abandonmentRate: 2.1,
    };
  }

  /**
   * Get real-time metrics
   */
  async getRealTimeMetrics(): Promise<RealTimeMetrics> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const [recentTransactions, currentHourMetrics] = await Promise.all([
      this.transactionRepository
        .createQueryBuilder('transaction')
        .leftJoinAndSelect('transaction.sender', 'sender')
        .orderBy('transaction.createdAt', 'DESC')
        .limit(10)
        .getMany(),

      this.transactionRepository
        .createQueryBuilder('transaction')
        .select('SUM(transaction.amount)', 'revenue')
        .addSelect('COUNT(*)', 'count')
        .where('transaction.createdAt >= :oneHourAgo', { oneHourAgo })
        .andWhere('transaction.status = :status', {
          status: TransactionStatus.COMPLETED,
        })
        .getRawOne(),
    ]);

    return {
      currentRevenue: parseFloat(currentHourMetrics?.revenue || '0'),
      currentTransactions: parseInt(currentHourMetrics?.count || '0'),
      activePaymentMethods: await this.getActivePaymentMethods(),
      recentTransactions: recentTransactions.map((t) => ({
        id: t.id,
        amount: t.amount,
        currency: 'EUR', // Default currency
        status: t.status,
        method: t.paymentMethod || 'CARD',
        createdAt: t.createdAt,
        userEmail: t.sender?.email || 'Unknown',
      })),
      systemHealth: await this.getSystemHealth(),
      alerts: await this.getActiveAlerts(),
    };
  }

  /**
   * Check for metric alerts
   */
  private async checkMetricsAlerts(metrics: PaymentMetrics): Promise<void> {
    const alerts: Array<{
      type: 'error' | 'warning';
      message: string;
      timestamp: Date;
    }> = [];

    if (metrics.successRate < this.alertThresholds.lowSuccessRate) {
      alerts.push({
        type: 'error' as const,
        message: `Low payment success rate: ${metrics.successRate.toFixed(1)}%`,
        timestamp: new Date(),
      });
    }

    if (
      metrics.refundRate &&
      metrics.refundRate > this.alertThresholds.highRefundRate
    ) {
      alerts.push({
        type: 'warning' as const,
        message: `High refund rate: ${metrics.refundRate.toFixed(1)}%`,
        timestamp: new Date(),
      });
    }

    if (alerts.length > 0) {
      for (const alert of alerts) {
        await this.adminNotificationsService.createAdminNotification({
          title: 'Payment System Alert',
          message: alert.message,
          type: AdminNotificationType.ERROR,
          priority: AdminNotificationPriority.HIGH,
          category: AdminNotificationCategory.PAYMENT,
        });
      }
    }
  }

  /**
   * Get system health status
   */
  public async getSystemHealth(): Promise<RealTimeMetrics['systemHealth']> {
    try {
      // Check Stripe connectivity
      const stripeStatus = await this.checkStripeHealth();

      return {
        stripeStatus,
        wiseStatus: 'operational', // Mock for now
        paypalStatus: 'operational', // Mock for now
        lastHealthCheck: new Date(),
      };
    } catch (error) {
      this.logger.error('Failed to check system health:', error);
      return {
        stripeStatus: 'down',
        wiseStatus: 'degraded',
        paypalStatus: 'degraded',
        lastHealthCheck: new Date(),
      };
    }
  }

  /**
   * Check Stripe health
   */
  private async checkStripeHealth(): Promise<
    'operational' | 'degraded' | 'down'
  > {
    try {
      if (!this.stripe) return 'down';

      const balance = await this.stripe.balance.retrieve();
      return balance ? 'operational' : 'down';
    } catch (error) {
      this.logger.error('Stripe health check failed:', error);
      return 'down';
    }
  }

  /**
   * Helper methods
   */
  private getDateRange(
    startDate?: Date,
    endDate?: Date,
  ): { startDate: Date; endDate: Date } {
    const end = endDate || new Date();
    const start =
      startDate || new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    return { startDate: start, endDate: end };
  }

  private calculateMetrics(
    transactions: Transaction[],
    totalRevenue: any,
    avgValue: any,
  ): PaymentMetrics {
    const completedTransactions = transactions.filter(
      (t) => t.status === TransactionStatus.COMPLETED,
    );
    const totalAmount = parseFloat(totalRevenue?.total || '0');
    const avgAmount = parseFloat(avgValue?.avg || '0');

    return {
      totalRevenue: totalAmount,
      totalTransactions: transactions.length,
      successRate:
        transactions.length > 0
          ? (completedTransactions.length / transactions.length) * 100
          : 0,
      averageTransactionValue: avgAmount,
      revenueByCurrency: this.groupByCurrency(transactions),
      transactionsByStatus: this.groupByStatus(transactions),
      transactionsByMethod: this.groupByMethod(transactions),
      dailyGrowth: this.calculateGrowth(transactions, 'day'),
      weeklyGrowth: this.calculateGrowth(transactions, 'week'),
      monthlyGrowth: this.calculateGrowth(transactions, 'month'),
    };
  }

  private groupByCurrency(transactions: Transaction[]): Record<string, number> {
    const groups: Record<string, number> = {};
    transactions.forEach((t) => {
      const currency = 'EUR'; // Default currency since Transaction entity doesn't have currency
      groups[currency] = (groups[currency] || 0) + t.amount;
    });
    return groups;
  }

  private groupByStatus(transactions: Transaction[]): Record<string, number> {
    const groups: Record<string, number> = {};
    transactions.forEach((t) => {
      groups[t.status] = (groups[t.status] || 0) + 1;
    });
    return groups;
  }

  private groupByMethod(transactions: Transaction[]): Record<string, number> {
    const groups: Record<string, number> = {};
    transactions.forEach((t) => {
      if (t.paymentMethod) {
        groups[t.paymentMethod] = (groups[t.paymentMethod] || 0) + 1;
      }
    });
    return groups;
  }

  private groupRefundsByReason(refunds: Transaction[]): Record<string, number> {
    const groups: Record<string, number> = {};
    refunds.forEach((r) => {
      const reason = r.providerMetadata?.refundReason || 'unknown';
      groups[reason] = (groups[reason] || 0) + 1;
    });
    return groups;
  }

  private getTopRefundReasons(
    refunds: Transaction[],
  ): Array<{ reason: string; count: number; amount: number }> {
    const reasons: Record<string, { count: number; amount: number }> = {};

    refunds.forEach((r) => {
      const reason = r.providerMetadata?.refundReason || 'unknown';
      if (!reasons[reason]) {
        reasons[reason] = { count: 0, amount: 0 };
      }
      reasons[reason].count += 1;
      reasons[reason].amount += Math.abs(r.amount);
    });

    return Object.entries(reasons)
      .map(([reason, data]) => ({ reason, ...data }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);
  }

  private getRefundTrends(
    refunds: Transaction[],
  ): Array<{ date: string; count: number; amount: number }> {
    const trends: Record<string, { count: number; amount: number }> = {};

    refunds.forEach((r) => {
      const date = r.createdAt.toISOString().split('T')[0];
      if (!trends[date]) {
        trends[date] = { count: 0, amount: 0 };
      }
      trends[date].count += 1;
      trends[date].amount += Math.abs(r.amount);
    });

    return Object.entries(trends)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private getRefundProcessingTime(
    refunds: Transaction[],
  ): Array<{ bookingId: string; processingTime: number }> {
    return refunds
      .filter((r) => r.providerMetadata?.originalTransactionId && r.bookingId)
      .map((r) => ({
        bookingId: r.bookingId!,
        processingTime:
          r.createdAt.getTime() -
          new Date(r.providerMetadata?.processedAt || r.createdAt).getTime(),
      }))
      .filter((item) => item.processingTime > 0);
  }

  private getWithdrawalTrends(
    withdrawals: Transaction[],
  ): Array<{ date: string; count: number; amount: number }> {
    const trends: Record<string, { count: number; amount: number }> = {};

    withdrawals.forEach((w) => {
      const date = w.createdAt.toISOString().split('T')[0];
      if (!trends[date]) {
        trends[date] = { count: 0, amount: 0 };
      }
      trends[date].count += 1;
      trends[date].amount += w.amount;
    });

    return Object.entries(trends)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private getWithdrawalProcessingTime(
    withdrawals: Transaction[],
  ): Array<{ transactionId: string; processingTime: number }> {
    return withdrawals
      .filter((w) => w.processedAt)
      .map((w) => ({
        transactionId: w.id,
        processingTime: w.processedAt!.getTime() - w.createdAt.getTime(),
      }))
      .filter((item) => item.processingTime > 0);
  }

  private calculateGrowth(
    transactions: Transaction[],
    period: 'day' | 'week' | 'month',
  ): number {
    // Simplified growth calculation
    const now = new Date();
    const currentPeriodStart = this.getPeriodStart(now, period);
    const previousPeriodStart = this.getPreviousPeriodStart(now, period);

    const currentPeriodTransactions = transactions.filter(
      (t) => t.createdAt >= currentPeriodStart && t.createdAt < now,
    );

    const previousPeriodTransactions = transactions.filter(
      (t) =>
        t.createdAt >= previousPeriodStart && t.createdAt < currentPeriodStart,
    );

    const currentRevenue = currentPeriodTransactions.reduce(
      (sum, t) => sum + t.amount,
      0,
    );
    const previousRevenue = previousPeriodTransactions.reduce(
      (sum, t) => sum + t.amount,
      0,
    );

    return previousRevenue > 0
      ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
      : 0;
  }

  private getPeriodStart(date: Date, period: 'day' | 'week' | 'month'): Date {
    const start = new Date(date);

    if (period === 'day') {
      start.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
      start.setDate(start.getDate() - start.getDay());
      start.setHours(0, 0, 0, 0);
    } else if (period === 'month') {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
    }

    return start;
  }

  private getPreviousPeriodStart(
    date: Date,
    period: 'day' | 'week' | 'month',
  ): Date {
    const start = this.getPeriodStart(date, period);

    if (period === 'day') {
      start.setDate(start.getDate() - 1);
    } else if (period === 'week') {
      start.setDate(start.getDate() - 7);
    } else if (period === 'month') {
      start.setMonth(start.getMonth() - 1);
    }

    return start;
  }

  private groupByHour(
    transactions: Transaction[],
  ): Array<{ hour: number; count: number; amount: number }> {
    const hours: Record<number, { count: number; amount: number }> = {};

    for (let i = 0; i < 24; i++) {
      hours[i] = { count: 0, amount: 0 };
    }

    transactions.forEach((t) => {
      const hour = t.createdAt.getHours();
      hours[hour].count += 1;
      hours[hour].amount += t.amount;
    });

    return Object.entries(hours).map(([hour, data]) => ({
      hour: parseInt(hour),
      ...data,
    }));
  }

  private groupByDay(
    transactions: Transaction[],
  ): Array<{ date: string; count: number; amount: number }> {
    const days: Record<string, { count: number; amount: number }> = {};

    transactions.forEach((t) => {
      const date = t.createdAt.toISOString().split('T')[0];
      if (!days[date]) {
        days[date] = { count: 0, amount: 0 };
      }
      days[date].count += 1;
      days[date].amount += t.amount;
    });

    return Object.entries(days)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private groupByWeek(
    transactions: Transaction[],
  ): Array<{ week: string; count: number; amount: number }> {
    const weeks: Record<string, { count: number; amount: number }> = {};

    transactions.forEach((t) => {
      const week = this.getWeekString(t.createdAt);
      if (!weeks[week]) {
        weeks[week] = { count: 0, amount: 0 };
      }
      weeks[week].count += 1;
      weeks[week].amount += t.amount;
    });

    return Object.entries(weeks)
      .map(([week, data]) => ({ week, ...data }))
      .sort((a, b) => a.week.localeCompare(b.week));
  }

  private groupByMonth(
    transactions: Transaction[],
  ): Array<{ month: string; count: number; amount: number }> {
    const months: Record<string, { count: number; amount: number }> = {};

    transactions.forEach((t) => {
      const month = t.createdAt.toISOString().slice(0, 7); // YYYY-MM
      if (!months[month]) {
        months[month] = { count: 0, amount: 0 };
      }
      months[month].count += 1;
      months[month].amount += t.amount;
    });

    return Object.entries(months)
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  private getWeekString(date: Date): string {
    const year = date.getFullYear();
    const week = this.getWeekNumber(date);
    return `${year}-W${week.toString().padStart(2, '0')}`;
  }

  private getWeekNumber(date: Date): number {
    const d = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
    );
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }

  private getTopCustomers(transactions: Transaction[]): Array<{
    userId: string;
    email: string;
    totalAmount: number;
    count: number;
  }> {
    const customers: Record<
      string,
      { email: string; totalAmount: number; count: number }
    > = {};

    transactions.forEach((t) => {
      if (t.senderId && t.sender) {
        const userId = t.senderId;
        if (!customers[userId]) {
          customers[userId] = {
            email: t.sender.email,
            totalAmount: 0,
            count: 0,
          };
        }
        customers[userId].totalAmount += t.amount;
        customers[userId].count += 1;
      }
    });

    return Object.entries(customers)
      .map(([userId, data]) => ({ userId, ...data }))
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 10);
  }

  private getGeographicDistribution(
    transactions: Transaction[],
  ): Array<{ country: string; count: number; amount: number }> {
    const countries: Record<string, { count: number; amount: number }> = {};

    transactions.forEach((t) => {
      const country = t.providerMetadata?.country || 'Unknown';
      if (!countries[country]) {
        countries[country] = { count: 0, amount: 0 };
      }
      countries[country].count += 1;
      countries[country].amount += t.amount;
    });

    return Object.entries(countries)
      .map(([country, data]) => ({ country, ...data }))
      .sort((a, b) => b.amount - a.amount);
  }

  private getDeviceAnalytics(
    transactions: Transaction[],
  ): Array<{ device: string; count: number; amount: number }> {
    const devices: Record<string, { count: number; amount: number }> = {};

    transactions.forEach((t) => {
      const device = t.providerMetadata?.device || 'Unknown';
      if (!devices[device]) {
        devices[device] = { count: 0, amount: 0 };
      }
      devices[device].count += 1;
      devices[device].amount += t.amount;
    });

    return Object.entries(devices)
      .map(([device, data]) => ({ device, ...data }))
      .sort((a, b) => b.amount - a.amount);
  }

  private getBrowserAnalytics(
    transactions: Transaction[],
  ): Array<{ browser: string; count: number; amount: number }> {
    const browsers: Record<string, { count: number; amount: number }> = {};

    transactions.forEach((t) => {
      const browser = t.providerMetadata?.browser || 'Unknown';
      if (!browsers[browser]) {
        browsers[browser] = { count: 0, amount: 0 };
      }
      browsers[browser].count += 1;
      browsers[browser].amount += t.amount;
    });

    return Object.entries(browsers)
      .map(([browser, data]) => ({ browser, ...data }))
      .sort((a, b) => b.amount - a.amount);
  }

  private getActivePaymentMethods(): string[] {
    // This would be implemented based on actual usage
    return ['card', 'google_pay', 'apple_pay', 'paypal'];
  }

  private async getActiveAlerts(): Promise<RealTimeMetrics['alerts']> {
    // This would check for current system alerts
    return [];
  }
}
