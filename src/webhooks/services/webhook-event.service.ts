import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { StripeWebhookEvent } from '../entities/stripe-webhook-event.entity';

export interface WebhookProcessingResult {
  success: boolean;
  isDuplicate: boolean;
  error?: string;
}

@Injectable()
export class WebhookEventService {
  private readonly logger = new Logger(WebhookEventService.name);

  constructor(
    @InjectRepository(StripeWebhookEvent)
    private webhookEventRepository: Repository<StripeWebhookEvent>,
  ) {}

  /**
   * Check if an event has already been processed
   */
  async isEventProcessed(eventId: string): Promise<boolean> {
    try {
      const existingEvent = await this.webhookEventRepository.findOne({
        where: { eventId }
      });
      
      return !!existingEvent;
    } catch (error) {
      this.logger.error(`Error checking if event ${eventId} is processed:`, error);
      // In case of error, assume it's processed to avoid double processing
      return true;
    }
  }

  /**
   * Store a webhook event for deduplication
   */
  async storeWebhookEvent(
    event: Stripe.Event,
    ipAddress?: string,
    userAgent?: string
  ): Promise<StripeWebhookEvent> {
    try {
      const webhookEvent = this.webhookEventRepository.create({
        eventId: event.id,
        eventType: event.type,
        payload: event,
        processed: false,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      });

      const savedEvent = await this.webhookEventRepository.save(webhookEvent);
      this.logger.log(`Webhook event stored: ${event.type} - ${event.id}`);
      
      return savedEvent;
    } catch (error) {
      this.logger.error(`Error storing webhook event ${event.id}:`, error);
      throw new Error(`Failed to store webhook event: ${error.message}`);
    }
  }

  /**
   * Mark an event as processed
   */
  async markEventAsProcessed(eventId: string, error?: string): Promise<void> {
    try {
      await this.webhookEventRepository.update(
        { eventId },
        {
          processed: true,
          processedAt: new Date(),
          processingError: error || null,
        }
      );
      
      this.logger.log(`Webhook event marked as processed: ${eventId}`);
    } catch (error) {
      this.logger.error(`Error marking event ${eventId} as processed:`, error);
    }
  }

  /**
   * Get unprocessed events for retry
   */
  async getUnprocessedEvents(limit: number = 100): Promise<StripeWebhookEvent[]> {
    try {
      return await this.webhookEventRepository.find({
        where: { processed: false },
        order: { createdAt: 'ASC' },
        take: limit,
      });
    } catch (error) {
      this.logger.error('Error getting unprocessed events:', error);
      return [];
    }
  }

  /**
   * Increment retry count for an event
   */
  async incrementRetryCount(eventId: string): Promise<void> {
    try {
      await this.webhookEventRepository.increment(
        { eventId },
        'retryCount',
        1
      );
      
      await this.webhookEventRepository.update(
        { eventId },
        { lastRetryAt: new Date() }
      );
    } catch (error) {
      this.logger.error(`Error incrementing retry count for ${eventId}:`, error);
    }
  }

  /**
   * Clean up old processed events (older than 30 days)
   */
  async cleanupOldEvents(): Promise<number> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await this.webhookEventRepository.createQueryBuilder()
        .delete()
        .where('processed = :processed', { processed: true })
        .andWhere('created_at < :date', { date: thirtyDaysAgo })
        .execute();

      const deletedCount = result.affected || 0;
      this.logger.log(`Cleaned up ${deletedCount} old webhook events`);
      
      return deletedCount;
    } catch (error) {
      this.logger.error('Error cleaning up old events:', error);
      return 0;
    }
  }

  /**
   * Validate event payload consistency
   */
  validateEventConsistency(event: Stripe.Event): boolean {
    try {
      // Basic validation
      if (!event.id || !event.type || !event.data) {
        this.logger.warn('Event missing required fields', { eventId: event.id });
        return false;
      }

      // Validate event ID format
      if (!event.id.startsWith('evt_')) {
        this.logger.warn('Invalid event ID format', { eventId: event.id });
        return false;
      }

      // Validate timestamp is reasonable (not in future, not too old)
      const eventTime = new Date(event.created * 1000);
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

      if (eventTime < fiveMinutesAgo || eventTime > oneHourFromNow) {
        this.logger.warn('Event timestamp outside acceptable range', {
          eventId: event.id,
          eventTime: eventTime.toISOString(),
          now: now.toISOString(),
        });
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Error validating event consistency:', error);
      return false;
    }
  }
}