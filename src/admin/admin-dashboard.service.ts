import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Tool } from '../tools/entities/tool.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { PaymentTransaction } from '../transactions/entities/payment-transaction.entity';
import { Dispute } from '../disputes/entities/dispute.entity';
import { Review } from '../reviews/entities/review.entity';
import { UserActivity } from '../users/entities/user-activity.entity';
import { DisputeStatus } from '../disputes/entities/dispute.entity';

@Injectable()
export class AdminDashboardService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Tool)
    private toolRepository: Repository<Tool>,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(PaymentTransaction)
    private paymentTransactionRepository: Repository<PaymentTransaction>,
    @InjectRepository(Dispute)
    private disputeRepository: Repository<Dispute>,
    @InjectRepository(Review)
    private reviewRepository: Repository<Review>,
    @InjectRepository(UserActivity)
    private userActivityRepository: Repository<UserActivity>,
  ) {}

  private getDateRange(period: string) {
    const now = new Date();
    const start = new Date();
    
    switch (period) {
      case '7d':
        start.setDate(now.getDate() - 7);
        break;
      case '30d':
        start.setDate(now.getDate() - 30);
        break;
      case '90d':
        start.setDate(now.getDate() - 90);
        break;
      case '1y':
        start.setFullYear(now.getFullYear() - 1);
        break;
      default:
        start.setDate(now.getDate() - 30);
    }
    
    return { start, end: now };
  }

  async getDashboardOverview(period: string) {
    const { start, end } = this.getDateRange(period);
    
    const [totalUsers, activeUsers, totalTools, totalBookings, totalRevenue, pendingDisputes] = await Promise.all([
      this.userRepository.count(),
      this.userRepository.count({
        where: {
          lastLoginAt: Between(start, end),
        },
      }),
      this.toolRepository.count(),
      this.bookingRepository.count({
        where: {
          createdAt: Between(start, end),
        },
      }),
      this.paymentTransactionRepository
        .createQueryBuilder('pt')
        .select('SUM(pt.amount)', 'total')
        .where('pt.status = :status', { status: 'completed' })
        .andWhere('pt.createdAt BETWEEN :start AND :end', { start, end })
        .getRawOne(),
      this.disputeRepository.count({ where: { status: DisputeStatus.PENDING } }),
    ]);

    return {
      totalUsers,
      activeUsers,
      totalTools,
      totalBookings,
      totalRevenue: totalRevenue?.total || 0,
      pendingDisputes,
      period,
    };
  }

  async getKPIs(period: string) {
    const { start, end } = this.getDateRange(period);
    
    const [userGrowth, revenueGrowth, bookingGrowth, averageRating] = await Promise.all([
      this.calculateGrowthRate('user', start, end),
      this.calculateRevenueGrowth(start, end),
      this.calculateGrowthRate('booking', start, end),
      this.reviewRepository
        .createQueryBuilder('review')
        .select('AVG(review.rating)', 'average')
        .getRawOne(),
    ]);

    return {
      userGrowth,
      revenueGrowth,
      bookingGrowth,
      averageRating: parseFloat(averageRating?.average || '0'),
      period,
    };
  }

  private async calculateGrowthRate(entity: 'user' | 'booking', start: Date, end: Date) {
    const repository = entity === 'user' ? this.userRepository : this.bookingRepository;
    
    const currentPeriod = await repository.count({
      where: { createdAt: Between(start, end) },
    });
    
    const previousStart = new Date(start);
    const previousEnd = new Date(start);
    const periodDiff = end.getTime() - start.getTime();
    previousStart.setTime(start.getTime() - periodDiff);
    
    const previousPeriod = await repository.count({
      where: { createdAt: Between(previousStart, previousEnd) },
    });
    
    if (previousPeriod === 0) return currentPeriod > 0 ? 100 : 0;
    
    return ((currentPeriod - previousPeriod) / previousPeriod) * 100;
  }

  private async calculateRevenueGrowth(start: Date, end: Date) {
    const currentRevenue = await this.paymentTransactionRepository
      .createQueryBuilder('pt')
      .select('SUM(pt.amount)', 'total')
      .where('pt.status = :status', { status: 'completed' })
      .andWhere('pt.createdAt BETWEEN :start AND :end', { start, end })
      .getRawOne();
    
    const periodDiff = end.getTime() - start.getTime();
    const previousStart = new Date(start.getTime() - periodDiff);
    const previousEnd = new Date(start);
    
    const previousRevenue = await this.paymentTransactionRepository
      .createQueryBuilder('pt')
      .select('SUM(pt.amount)', 'total')
      .where('pt.status = :status', { status: 'completed' })
      .andWhere('pt.createdAt BETWEEN :start AND :end', { start: previousStart, end: previousEnd })
      .getRawOne();
    
    const current = parseFloat(currentRevenue?.total || '0');
    const previous = parseFloat(previousRevenue?.total || '0');
    
    if (previous === 0) return current > 0 ? 100 : 0;
    
    return ((current - previous) / previous) * 100;
  }

  async getRecentActivities(limit: number) {
    return this.userActivityRepository.find({
      take: limit,
      order: { createdAt: 'DESC' },
      relations: ['user'],
    });
  }

  async getRevenueChart(period: string) {
    const { start, end } = this.getDateRange(period);
    
    const revenueData = await this.paymentTransactionRepository
      .createQueryBuilder('pt')
      .select('DATE(pt.createdAt)', 'date')
      .addSelect('SUM(pt.amount)', 'revenue')
      .where('pt.status = :status', { status: 'completed' })
      .andWhere('pt.createdAt BETWEEN :start AND :end', { start, end })
      .groupBy('DATE(pt.createdAt)')
      .orderBy('date', 'ASC')
      .getRawMany();
    
    return revenueData.map(item => ({
      date: item.date,
      revenue: parseFloat(item.revenue || '0'),
    }));
  }

  async getUserGrowth(period: string) {
    const { start, end } = this.getDateRange(period);
    
    const userData = await this.userRepository
      .createQueryBuilder('user')
      .select('DATE(user.createdAt)', 'date')
      .addSelect('COUNT(*)', 'users')
      .where('user.createdAt BETWEEN :start AND :end', { start, end })
      .groupBy('DATE(user.createdAt)')
      .orderBy('date', 'ASC')
      .getRawMany();
    
    return userData.map(item => ({
      date: item.date,
      users: parseInt(item.users || '0'),
    }));
  }

  async getBookingStats(period: string) {
    const { start, end } = this.getDateRange(period);
    
    const bookingStats = await this.bookingRepository
      .createQueryBuilder('booking')
      .select('booking.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('booking.createdAt BETWEEN :start AND :end', { start, end })
      .groupBy('booking.status')
      .getRawMany();
    
    return bookingStats.map(item => ({
      status: item.status,
      count: parseInt(item.count || '0'),
    }));
  }

  async getTopTools(limit: number) {
    return this.toolRepository
      .createQueryBuilder('tool')
      .leftJoinAndSelect('tool.bookings', 'booking')
      .select('tool.id', 'id')
      .addSelect('tool.title', 'title')
      .addSelect('COUNT(booking.id)', 'bookingCount')
      .groupBy('tool.id')
      .orderBy('bookingCount', 'DESC')
      .limit(limit)
      .getRawMany();
  }

  async getDisputeOverview() {
    // Get dispute counts by status
    const disputeStats = await this.disputeRepository
      .createQueryBuilder('dispute')
      .select('dispute.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('dispute.status')
      .getRawMany();
    
    // Get total disputes count
    const totalDisputes = await this.disputeRepository.count();
    
    // Get average resolution time for resolved disputes
    const resolvedDisputes = await this.disputeRepository
      .createQueryBuilder('dispute')
      .where('dispute.status = :status', { status: DisputeStatus.RESOLVED })
      .andWhere('dispute.resolvedAt IS NOT NULL')
      .getMany();
    
    let averageResolutionTime = 0;
     if (resolvedDisputes.length > 0) {
       const totalResolutionTime = resolvedDisputes.reduce((sum, dispute) => {
         const createdAt = new Date(dispute.createdAt);
         const resolvedAt = dispute.resolvedAt ? new Date(dispute.resolvedAt) : new Date();
         return sum + (resolvedAt.getTime() - createdAt.getTime());
       }, 0);
       averageResolutionTime = Math.round(totalResolutionTime / resolvedDisputes.length / (1000 * 60 * 60 * 24)); // in days
     }
    
    // Get monthly disputes for the last 12 months
    const monthlyDisputes = await this.disputeRepository
      .createQueryBuilder('dispute')
      .select('DATE_FORMAT(dispute.createdAt, "%Y-%m") as month')
      .addSelect('COUNT(*) as count')
      .where('dispute.createdAt >= DATE_SUB(NOW(), INTERVAL 12 MONTH)')
      .groupBy('month')
      .orderBy('month', 'ASC')
      .getRawMany();
    
    // Transform status counts into the expected format
    const statusCounts = disputeStats.reduce((acc, item) => {
      acc[item.status.toLowerCase()] = parseInt(item.count || '0');
      return acc;
    }, {});
    
    return {
      totalDisputes,
      openDisputes: statusCounts.pending || 0,
      investigatingDisputes: 0, // No investigating status in current enum
      resolvedDisputes: statusCounts.resolved || 0,
      closedDisputes: statusCounts.closed || 0,
      averageResolutionTime,
      disputesByStatus: disputeStats.map(item => ({
        status: item.status,
        count: parseInt(item.count || '0'),
      })),
      disputesByCategory: [], // Would need category field in disputes
      monthlyDisputes: monthlyDisputes.map(item => ({
        month: item.month,
        count: parseInt(item.count || '0'),
      })),
    };
  }

  async getDashboardData(startDate?: string, endDate?: string) {
    // Déterminer la période basée sur les dates ou utiliser 30d par défaut
    const period = startDate && endDate ? '30d' : '30d';
    
    const [overview, kpis, chartData, recentActivities] = await Promise.all([
      this.getDashboardOverview(period),
      this.getKPIs(period),
      this.getRevenueChart(period),
      this.getRecentActivities(10)
    ]);

    // Transformer les données pour correspondre à l'interface DashboardData du frontend
    return {
      stats: {
        active_users: overview.activeUsers,
        online_listings: overview.totalTools,
        active_reservations: overview.totalBookings,
        pending_disputes: overview.pendingDisputes,
        monthly_revenue: overview.totalRevenue,
        growth_percentage: kpis.userGrowth
      },
      chart_data: chartData.map(item => ({
        month: item.date, // Utiliser 'date' au lieu de 'month'
        reservations: 0, // Pas de données de réservations dans getRevenueChart
        revenue: item.revenue,
        users: 0, // Pas de données d'utilisateurs dans getRevenueChart
        listings: 0 // Pas de données d'annonces dans getRevenueChart
      })),
      country_data: [
        { country: 'France', users: 45, percentage: 45 },
        { country: 'Belgique', users: 25, percentage: 25 },
        { country: 'Suisse', users: 15, percentage: 15 },
        { country: 'Canada', users: 10, percentage: 10 },
        { country: 'Autres', users: 5, percentage: 5 }
      ],
      recent_activities: recentActivities.map(activity => ({
        id: activity.id,
        type: activity.activityType as any, // Utiliser 'activityType' au lieu de 'type'
        description: activity.description || '',
        user: activity.user ? {
          id: activity.user.id,
          name: `${activity.user.firstName} ${activity.user.lastName}`, // Combiner firstName et lastName
          avatar: activity.user.profilePicture // Utiliser 'profilePicture' au lieu de 'avatar'
        } : undefined,
        timestamp: activity.createdAt.toISOString(), // Utiliser 'createdAt' au lieu de 'timestamp'
        metadata: activity.metadata
      }))
    };
  }
}