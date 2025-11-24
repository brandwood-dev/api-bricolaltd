import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { WebhookEventService } from './webhook-event.service';

@Injectable()
export class WebhookRetryService {
  private readonly logger = new Logger(WebhookRetryService.name);
  private readonly maxRetries = 3;
  private readonly retryDelays = [1000, 5000, 15000]; // 1s, 5s, 15s

  constructor(private webhookEventService: WebhookEventService) {}

  /**
   * Process unprocessed webhook events with retry logic
   */
  async processUnprocessedEvents(): Promise<void> {
    this.logger.log('Starting processing of unprocessed webhook events');

    try {
      const unprocessedEvents =
        await this.webhookEventService.getUnprocessedEvents(50);

      if (unprocessedEvents.length === 0) {
        this.logger.log('No unprocessed webhook events found');
        return;
      }

      this.logger.log(`Found ${unprocessedEvents.length} unprocessed events`);

      for (const event of unprocessedEvents) {
        try {
          await this.processEventWithRetry(event);
        } catch (error) {
          this.logger.error(
            `Failed to process event ${event.eventId} after all retries:`,
            error,
          );

          // Mark as processed with error
          await this.webhookEventService.markEventAsProcessed(
            event.eventId,
            error.message || 'Failed after all retries',
          );
        }
      }
    } catch (error) {
      this.logger.error('Error during unprocessed events processing:', error);
    }
  }

  /**
   * Process a single event with retry logic
   */
  private async processEventWithRetry(event: any): Promise<void> {
    const eventId = event.eventId;
    const retryCount = event.retryCount || 0;

    if (retryCount >= this.maxRetries) {
      this.logger.warn(
        `Event ${eventId} has exceeded max retries (${this.maxRetries})`,
      );

      await this.webhookEventService.markEventAsProcessed(
        eventId,
        'Max retries exceeded',
      );
      return;
    }

    try {
      this.logger.log(
        `Processing event ${eventId} (retry ${retryCount + 1}/${this.maxRetries})`,
      );

      // Parse the Stripe event from stored payload
      const stripeEvent = event.payload as Stripe.Event;

      // Process the event (this will be called from the main webhook service)
      await this.processStripeEvent(stripeEvent);

      // Mark as successfully processed
      await this.webhookEventService.markEventAsProcessed(eventId);

      this.logger.log(`Event ${eventId} processed successfully`);
    } catch (error) {
      this.logger.error(
        `Error processing event ${eventId} (retry ${retryCount + 1}):`,
        error,
      );

      // Increment retry count
      await this.webhookEventService.incrementRetryCount(eventId);

      // If we haven't exceeded max retries, schedule next retry
      if (retryCount + 1 < this.maxRetries) {
        const delay = this.retryDelays[retryCount] || 30000; // Default to 30s

        this.logger.log(
          `Scheduling retry ${retryCount + 2} for event ${eventId} in ${delay}ms`,
        );

        // Schedule next retry (in a real implementation, you'd use a job queue)
        setTimeout(async () => {
          try {
            await this.processEventWithRetry(event);
          } catch (retryError) {
            this.logger.error(
              `Scheduled retry failed for event ${eventId}:`,
              retryError,
            );
          }
        }, delay);
      } else {
        // Max retries exceeded
        await this.webhookEventService.markEventAsProcessed(
          eventId,
          error.message || 'Failed after max retries',
        );

        this.logger.error(`Max retries exceeded for event ${eventId}`);
      }
    }
  }

  /**
   * Process a Stripe event (to be implemented by the main webhook service)
   */
  private async processStripeEvent(event: Stripe.Event): Promise<void> {
    // This is a placeholder - in a real implementation, you would inject
    // the main webhook service and call its processWebhookEvent method

    this.logger.log(`Processing Stripe event: ${event.type} - ${event.id}`);

    // For now, just log the event
    // The actual implementation would call the webhook service
    switch (event.type) {
      case 'payment_intent.succeeded':
        this.logger.log(`Payment intent succeeded: ${event.data.object.id}`);
        break;
      case 'payment_intent.payment_failed':
        this.logger.log(`Payment intent failed: ${event.data.object.id}`);
        break;
      case 'charge.refunded':
        this.logger.log(`Charge refunded: ${event.data.object.id}`);
        break;
      default:
        this.logger.log(`Unhandled event type in retry: ${event.type}`);
    }
  }

  /**
   * Schedule a periodic cleanup of old processed events
   */
  async scheduleCleanup(): Promise<void> {
    try {
      const deletedCount = await this.webhookEventService.cleanupOldEvents();

      if (deletedCount > 0) {
        this.logger.log(`Cleaned up ${deletedCount} old webhook events`);
      }
    } catch (error) {
      this.logger.error('Error during webhook events cleanup:', error);
    }
  }
}
