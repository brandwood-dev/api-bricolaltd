import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WebhookRetryService } from './services/webhook-retry.service';
import { WebhookRateLimitService } from './services/webhook-rate-limit.service';
import { WebhookEventService } from './services/webhook-event.service';

@Injectable()
export class WebhookCronService {
  private readonly logger = new Logger(WebhookCronService.name);

  constructor(
    private webhookRetryService: WebhookRetryService,
    private webhookRateLimitService: WebhookRateLimitService,
    private webhookEventService: WebhookEventService,
  ) {}

  /**
   * Process unprocessed webhook events every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleWebhookRetries(): Promise<void> {
    try {
      this.logger.log('Starting webhook retry processing');
      
      await this.webhookRetryService.processUnprocessedEvents();
      
      this.logger.log('Webhook retry processing completed');
    } catch (error) {
      this.logger.error('Error during webhook retry processing:', error);
    }
  }

  /**
   * Clean up expired rate limit entries every hour
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupRateLimits(): Promise<void> {
    try {
      this.logger.log('Starting rate limit cleanup');
      
      this.webhookRateLimitService.cleanupExpiredEntries();
      
      this.logger.log('Rate limit cleanup completed');
    } catch (error) {
      this.logger.error('Error during rate limit cleanup:', error);
    }
  }

  /**
   * Clean up old processed webhook events daily at 2 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupOldEvents(): Promise<void> {
    try {
      this.logger.log('Starting old webhook events cleanup');
      
      const deletedCount = await this.webhookEventService.cleanupOldEvents();
      
      this.logger.log(`Old webhook events cleanup completed. Deleted ${deletedCount} events`);
    } catch (error) {
      this.logger.error('Error during old webhook events cleanup:', error);
    }
  }

  /**
   * Health check for webhook processing every 30 minutes
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async webhookHealthCheck(): Promise<void> {
    try {
      this.logger.log('Starting webhook health check');
      
      // Get count of unprocessed events older than 1 hour
      const unprocessedEvents = await this.webhookEventService.getUnprocessedEvents(1000);
      const oldUnprocessedEvents = unprocessedEvents.filter(
        event => new Date().getTime() - event.createdAt.getTime() > 60 * 60 * 1000 // 1 hour
      );

      if (oldUnprocessedEvents.length > 0) {
        this.logger.warn(`Found ${oldUnprocessedEvents.length} unprocessed webhook events older than 1 hour`, {
          eventIds: oldUnprocessedEvents.map(e => e.eventId),
          eventTypes: oldUnprocessedEvents.map(e => e.eventType),
        });
      } else {
        this.logger.log('Webhook health check passed - no old unprocessed events');
      }
    } catch (error) {
      this.logger.error('Error during webhook health check:', error);
    }
  }

  /**
   * Monitor webhook processing metrics every 10 minutes
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async webhookMetrics(): Promise<void> {
    try {
      // This would integrate with your monitoring system
      // For now, just log basic metrics
      this.logger.log('Webhook metrics check', {
        timestamp: new Date().toISOString(),
        // Add your metrics here
      });
    } catch (error) {
      this.logger.error('Error during webhook metrics collection:', error);
    }
  }
}