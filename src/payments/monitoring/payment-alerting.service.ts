import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PaymentMonitoringService } from './payment-monitoring.service';
import { AdminNotificationsService } from '../../admin/admin-notifications.service';
import {
  NotificationType as AdminNotificationType,
  NotificationPriority as AdminNotificationPriority,
  NotificationCategory as AdminNotificationCategory,
} from '../../admin/dto/admin-notifications.dto';

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  metric: string;
  threshold: number;
  comparison: '>' | '<' | '==' | '>=' | '<=';
  timeWindow: number; // minutes
  severity: 'critical' | 'warning' | 'info';
  enabled: boolean;
  cooldown: number; // minutes
  lastTriggered?: Date;
}

export interface AlertContext {
  metric: string;
  currentValue: number;
  threshold: number;
  comparison: string;
  timeWindow: number;
  severity: string;
  timestamp: Date;
  additionalContext?: Record<string, any>;
}

@Injectable()
export class PaymentAlertingService {
  private readonly logger = new Logger(PaymentAlertingService.name);
  private alertRules: AlertRule[] = [
    {
      id: 'low_success_rate',
      name: 'Low Payment Success Rate',
      description:
        'Payment success rate has dropped below acceptable threshold',
      metric: 'successRate',
      threshold: 85,
      comparison: '<',
      timeWindow: 60, // 1 hour
      severity: 'critical',
      enabled: true,
      cooldown: 30, // 30 minutes
    },
    {
      id: 'high_refund_rate',
      name: 'High Refund Rate',
      description: 'Refund rate has exceeded normal threshold',
      metric: 'refundRate',
      threshold: 5,
      comparison: '>',
      timeWindow: 120, // 2 hours
      severity: 'warning',
      enabled: true,
      cooldown: 60, // 1 hour
    },
    {
      id: 'high_withdrawal_pending',
      name: 'High Pending Withdrawals',
      description: 'Too many withdrawals are pending processing',
      metric: 'pendingWithdrawals',
      threshold: 50,
      comparison: '>',
      timeWindow: 30, // 30 minutes
      severity: 'warning',
      enabled: true,
      cooldown: 30, // 30 minutes
    },
    {
      id: 'long_processing_time',
      name: 'Long Payment Processing Time',
      description: 'Average payment processing time is too high',
      metric: 'averageProcessingTime',
      threshold: 30000, // 30 seconds
      comparison: '>',
      timeWindow: 60, // 1 hour
      severity: 'warning',
      enabled: true,
      cooldown: 30, // 30 minutes
    },
    {
      id: 'high_transaction_volume',
      name: 'Unusually High Transaction Volume',
      description: 'Transaction volume is significantly higher than normal',
      metric: 'transactionVolume',
      threshold: 1000, // transactions per hour
      comparison: '>',
      timeWindow: 60, // 1 hour
      severity: 'info',
      enabled: true,
      cooldown: 120, // 2 hours
    },
    {
      id: 'low_3ds_success_rate',
      name: 'Low 3D Secure Success Rate',
      description: '3D Secure authentication success rate is below threshold',
      metric: 'threeDSSuccessRate',
      threshold: 80,
      comparison: '<',
      timeWindow: 60, // 1 hour
      severity: 'warning',
      enabled: true,
      cooldown: 30, // 30 minutes
    },
    {
      id: 'stripe_connectivity',
      name: 'Stripe Connectivity Issue',
      description: 'Stripe API connectivity is degraded or unavailable',
      metric: 'stripeStatus',
      threshold: 1, // 1 = operational, 0 = down
      comparison: '<',
      timeWindow: 5, // 5 minutes
      severity: 'critical',
      enabled: true,
      cooldown: 15, // 15 minutes
    },
    {
      id: 'high_chargeback_rate',
      name: 'High Chargeback Rate',
      description: 'Chargeback rate is above acceptable threshold',
      metric: 'chargebackRate',
      threshold: 1,
      comparison: '>',
      timeWindow: 1440, // 24 hours
      severity: 'critical',
      enabled: true,
      cooldown: 360, // 6 hours
    },
    {
      id: 'fraud_detection',
      name: 'Potential Fraud Detected',
      description: 'Suspicious payment patterns detected',
      metric: 'fraudScore',
      threshold: 75,
      comparison: '>',
      timeWindow: 30, // 30 minutes
      severity: 'critical',
      enabled: true,
      cooldown: 60, // 1 hour
    },
    {
      id: 'currency_volatility',
      name: 'High Currency Volatility',
      description: 'Exchange rate volatility is above normal',
      metric: 'currencyVolatility',
      threshold: 5, // 5% volatility
      comparison: '>',
      timeWindow: 60, // 1 hour
      severity: 'info',
      enabled: true,
      cooldown: 120, // 2 hours
    },
  ];

  constructor(
    private paymentMonitoringService: PaymentMonitoringService,
    private adminNotificationsService: AdminNotificationsService,
  ) {}

  /**
   * Check all alert rules and trigger alerts if necessary
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkAlerts(): Promise<void> {
    this.logger.log('Running payment system health check...');

    try {
      // Get current metrics
      const currentMetrics = await this.getCurrentMetrics();

      // Check each alert rule
      for (const rule of this.alertRules) {
        if (!rule.enabled) continue;

        // Check cooldown
        if (rule.lastTriggered && this.isInCooldown(rule)) {
          continue;
        }

        await this.checkAlertRule(rule, currentMetrics);
      }
    } catch (error) {
      this.logger.error('Error during alert check:', error);
    }
  }

  /**
   * Check individual alert rule
   */
  private async checkAlertRule(
    rule: AlertRule,
    metrics: Record<string, number>,
  ): Promise<void> {
    try {
      const currentValue = metrics[rule.metric];

      if (currentValue === undefined) {
        this.logger.warn(`Metric ${rule.metric} not found in current metrics`);
        return;
      }

      const shouldTrigger = this.evaluateThreshold(
        currentValue,
        rule.threshold,
        rule.comparison,
      );

      if (shouldTrigger) {
        await this.triggerAlert(rule, {
          metric: rule.metric,
          currentValue,
          threshold: rule.threshold,
          comparison: rule.comparison,
          timeWindow: rule.timeWindow,
          severity: rule.severity,
          timestamp: new Date(),
          additionalContext: {
            ruleName: rule.name,
            ruleDescription: rule.description,
          },
        });

        // Update last triggered time
        rule.lastTriggered = new Date();
      }
    } catch (error) {
      this.logger.error(`Error checking alert rule ${rule.id}:`, error);
    }
  }

  /**
   * Get current system metrics
   */
  private async getCurrentMetrics(): Promise<Record<string, number>> {
    try {
      // Get payment metrics
      const paymentMetrics =
        await this.paymentMonitoringService.getPaymentMetrics();

      // Get real-time metrics
      const realTimeMetrics =
        await this.paymentMonitoringService.getRealTimeMetrics();

      // Get system health
      const systemHealth =
        await this.paymentMonitoringService.getSystemHealth();

      return {
        successRate: paymentMetrics.successRate,
        refundRate: paymentMetrics.refundRate || 0,
        pendingWithdrawals: realTimeMetrics.recentTransactions.filter(
          (t) => t.status === 'pending',
        ).length,
        averageProcessingTime: 0, // Mock for now since property doesn't exist
        transactionVolume: realTimeMetrics.currentTransactions,
        threeDSSuccessRate: 94.2, // Mock for now
        stripeStatus: systemHealth.stripeStatus === 'operational' ? 1 : 0,
        chargebackRate: 0.3, // Mock for now
        fraudScore: 25, // Mock for now
        currencyVolatility: 2.1, // Mock for now
      };
    } catch (error) {
      this.logger.error('Error getting current metrics:', error);
      return {};
    }
  }

  /**
   * Evaluate threshold condition
   */
  private evaluateThreshold(
    currentValue: number,
    threshold: number,
    comparison: string,
  ): boolean {
    switch (comparison) {
      case '>':
        return currentValue > threshold;
      case '<':
        return currentValue < threshold;
      case '==':
        return currentValue === threshold;
      case '>=':
        return currentValue >= threshold;
      case '<=':
        return currentValue <= threshold;
      default:
        this.logger.warn(`Unknown comparison operator: ${comparison}`);
        return false;
    }
  }

  /**
   * Check if alert is in cooldown period
   */
  private isInCooldown(rule: AlertRule): boolean {
    if (!rule.lastTriggered) return false;

    const now = new Date();
    const cooldownEnd = new Date(
      rule.lastTriggered.getTime() + rule.cooldown * 60 * 1000,
    );

    return now < cooldownEnd;
  }

  /**
   * Trigger alert
   */
  private async triggerAlert(
    rule: AlertRule,
    context: AlertContext,
  ): Promise<void> {
    try {
      this.logger.warn(`Alert triggered: ${rule.name}`, context);

      // Create admin notification
      await this.createAdminNotification(rule, context);

      // Log alert for audit trail
      await this.logAlert(rule, context);

      // Additional alert actions based on severity
      if (rule.severity === 'critical') {
        await this.handleCriticalAlert(rule, context);
      } else if (rule.severity === 'warning') {
        await this.handleWarningAlert(rule, context);
      }
    } catch (error) {
      this.logger.error('Error triggering alert:', error);
    }
  }

  /**
   * Create admin notification for alert
   */
  private async createAdminNotification(
    rule: AlertRule,
    context: AlertContext,
  ): Promise<void> {
    const title = `Payment Alert: ${rule.name}`;
    const message = this.formatAlertMessage(rule, context);

    const notificationType = this.getNotificationType(rule.severity);
    const notificationPriority = this.getNotificationPriority(rule.severity);

    await this.adminNotificationsService.createAdminNotification({
      title,
      message,
      type: notificationType,
      priority: notificationPriority,
      category: AdminNotificationCategory.PAYMENT,
    });
  }

  /**
   * Format alert message
   */
  private formatAlertMessage(rule: AlertRule, context: AlertContext): string {
    const { currentValue, threshold, comparison } = context;

    let comparisonText = '';
    switch (comparison) {
      case '>':
        comparisonText = 'exceeded';
        break;
      case '<':
        comparisonText = 'dropped below';
        break;
      case '>=':
        comparisonText = 'met or exceeded';
        break;
      case '<=':
        comparisonText = 'met or dropped below';
        break;
      default:
        comparisonText = 'met';
    }

    return `${rule.description}. Current value: ${currentValue.toFixed(2)} ${comparisonText} threshold: ${threshold.toFixed(2)}`;
  }

  /**
   * Get notification type based on severity
   */
  private getNotificationType(severity: string): AdminNotificationType {
    switch (severity) {
      case 'critical':
        return AdminNotificationType.ERROR;
      case 'warning':
        return AdminNotificationType.WARNING;
      case 'info':
        return AdminNotificationType.INFO;
      default:
        return AdminNotificationType.INFO;
    }
  }

  /**
   * Get notification priority based on severity
   */
  private getNotificationPriority(severity: string): AdminNotificationPriority {
    switch (severity) {
      case 'critical':
        return AdminNotificationPriority.HIGH;
      case 'warning':
        return AdminNotificationPriority.MEDIUM;
      case 'info':
        return AdminNotificationPriority.LOW;
      default:
        return AdminNotificationPriority.LOW;
    }
  }

  /**
   * Log alert for audit trail
   */
  private async logAlert(
    rule: AlertRule,
    context: AlertContext,
  ): Promise<void> {
    // This would typically log to a database or external logging service
    this.logger.log(`Alert logged: ${rule.id}`, {
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      context,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle critical alert
   */
  private async handleCriticalAlert(
    rule: AlertRule,
    context: AlertContext,
  ): Promise<void> {
    // Additional critical alert actions
    this.logger.error(`CRITICAL ALERT: ${rule.name}`, context);

    // Could send SMS, email, Slack notification, etc.
    // Could trigger incident response procedures
    // Could automatically scale resources
    // Could block certain payment methods temporarily
  }

  /**
   * Handle warning alert
   */
  private async handleWarningAlert(
    rule: AlertRule,
    context: AlertContext,
  ): Promise<void> {
    // Additional warning alert actions
    this.logger.warn(`WARNING ALERT: ${rule.name}`, context);

    // Could send email notifications
    // Could increase monitoring frequency
    // Could prepare for potential issues
  }

  /**
   * Get current alert rules
   */
  getAlertRules(): AlertRule[] {
    return this.alertRules.map((rule) => ({
      ...rule,
      // Don't expose lastTriggered in API responses
      lastTriggered: undefined,
    }));
  }

  /**
   * Update alert rule
   */
  async updateAlertRule(
    ruleId: string,
    updates: Partial<AlertRule>,
  ): Promise<AlertRule | null> {
    const ruleIndex = this.alertRules.findIndex((r) => r.id === ruleId);

    if (ruleIndex === -1) {
      return null;
    }

    this.alertRules[ruleIndex] = {
      ...this.alertRules[ruleIndex],
      ...updates,
    };

    return this.alertRules[ruleIndex];
  }

  /**
   * Enable/disable alert rule
   */
  async toggleAlertRule(ruleId: string, enabled: boolean): Promise<boolean> {
    const rule = this.alertRules.find((r) => r.id === ruleId);

    if (!rule) {
      return false;
    }

    rule.enabled = enabled;
    return true;
  }

  /**
   * Get alert history (mock implementation)
   */
  async getAlertHistory(
    startDate?: Date,
    endDate?: Date,
    severity?: string,
    limit: number = 100,
  ): Promise<any[]> {
    // This would typically query a database
    // For now, return mock data
    return [
      {
        id: 'alert_001',
        ruleId: 'low_success_rate',
        ruleName: 'Low Payment Success Rate',
        severity: 'critical',
        triggeredAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        resolvedAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
        currentValue: 82.3,
        threshold: 85,
        status: 'resolved',
      },
      {
        id: 'alert_002',
        ruleId: 'high_refund_rate',
        ruleName: 'High Refund Rate',
        severity: 'warning',
        triggeredAt: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
        resolvedAt: null,
        currentValue: 6.8,
        threshold: 5,
        status: 'active',
      },
    ];
  }

  /**
   * Test alert rule
   */
  async testAlertRule(ruleId: string): Promise<boolean> {
    const rule = this.alertRules.find((r) => r.id === ruleId);

    if (!rule) {
      return false;
    }

    // Mock current value for testing
    const mockValue = rule.threshold + (rule.comparison === '>' ? 10 : -10);

    const context: AlertContext = {
      metric: rule.metric,
      currentValue: mockValue,
      threshold: rule.threshold,
      comparison: rule.comparison,
      timeWindow: rule.timeWindow,
      severity: rule.severity,
      timestamp: new Date(),
      additionalContext: {
        testMode: true,
        ruleName: rule.name,
        ruleDescription: rule.description,
      },
    };

    await this.triggerAlert(rule, context);
    return true;
  }

  /**
   * Get system health status
   */
  async getSystemHealth(): Promise<any> {
    try {
      const metrics = await this.getCurrentMetrics();
      const activeAlerts = await this.getAlertHistory(
        new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        new Date(),
        undefined,
        10,
      );

      return {
        timestamp: new Date().toISOString(),
        overallStatus: this.calculateOverallStatus(metrics, activeAlerts),
        metrics,
        activeAlerts: activeAlerts.length,
        alertRules: {
          total: this.alertRules.length,
          enabled: this.alertRules.filter((r) => r.enabled).length,
          critical: this.alertRules.filter((r) => r.severity === 'critical')
            .length,
          warning: this.alertRules.filter((r) => r.severity === 'warning')
            .length,
          info: this.alertRules.filter((r) => r.severity === 'info').length,
        },
      };
    } catch (error) {
      this.logger.error('Error getting system health:', error);
      return {
        timestamp: new Date().toISOString(),
        overallStatus: 'error',
        error: error.message,
      };
    }
  }

  /**
   * Calculate overall system status
   */
  private calculateOverallStatus(
    metrics: Record<string, number>,
    activeAlerts: any[],
  ): string {
    const criticalAlerts = activeAlerts.filter(
      (a) => a.severity === 'critical',
    ).length;
    const warningAlerts = activeAlerts.filter(
      (a) => a.severity === 'warning',
    ).length;

    if (criticalAlerts > 0) {
      return 'critical';
    } else if (warningAlerts > 0) {
      return 'warning';
    } else if (metrics.successRate && metrics.successRate < 90) {
      return 'degraded';
    } else {
      return 'healthy';
    }
  }
}
