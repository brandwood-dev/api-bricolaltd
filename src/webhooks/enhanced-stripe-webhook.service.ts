import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { TransactionStatus } from '../transactions/enums/transaction-status.enum';
import { TransactionType } from '../transactions/enums/transaction-type.enum';
import { AdminNotificationsService } from '../admin/admin-notifications.service';
import {
  NotificationCategory as AdminNotificationCategory,
  NotificationPriority as AdminNotificationPriority,
  NotificationType as AdminNotificationType,
} from '../admin/dto/admin-notifications.dto';
import { WebhookEventService } from './services/webhook-event.service';
import { WebhookRetryService } from './services/webhook-retry.service';
import { WalletsService } from '../wallets/wallets.service';

export interface WebhookProcessingResult {
  success: boolean;
  eventType: string;
  eventId: string;
  message?: string;
  isDuplicate?: boolean;
}

@Injectable()
export class EnhancedStripeWebhookService {
  private readonly logger = new Logger(EnhancedStripeWebhookService.name);
  private stripe: Stripe;

  constructor(
    @InjectRepository(Transaction)
    private transactionsRepository: Repository<Transaction>,
    @InjectRepository(Booking)
    private bookingsRepository: Repository<Booking>,
    private configService: ConfigService,
    private adminNotificationsService: AdminNotificationsService,
    private webhookEventService: WebhookEventService,
    private webhookRetryService: WebhookRetryService,
    private walletsService: WalletsService,
  ) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-09-30.clover',
    });
  }

  /**
   * Process a Stripe webhook with comprehensive security and error handling
   */
  async processWebhook(
    event: Stripe.Event,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<WebhookProcessingResult> {
    const startTime = Date.now();

    try {
      this.logger.log(`Processing webhook: ${event.type} - ${event.id}`, {
        eventId: event.id,
        eventType: event.type,
        ipAddress,
        userAgent,
      });

      // Validate event consistency
      if (!this.webhookEventService.validateEventConsistency(event)) {
        throw new BadRequestException('Invalid event structure');
      }

      // Check for duplicate events
      const isDuplicate = await this.webhookEventService.isEventProcessed(
        event.id,
      );
      if (isDuplicate) {
        this.logger.warn(`Duplicate event received: ${event.id}`);
        return {
          success: true,
          eventType: event.type,
          eventId: event.id,
          message: 'Event already processed',
          isDuplicate: true,
        };
      }

      // Store the event for deduplication
      await this.webhookEventService.storeWebhookEvent(
        event,
        ipAddress,
        userAgent,
      );

      // Process the event based on its type
      await this.processWebhookEvent(event);

      // Mark event as successfully processed
      await this.webhookEventService.markEventAsProcessed(event.id);

      const processingTime = Date.now() - startTime;
      this.logger.log(
        `Webhook processed successfully in ${processingTime}ms: ${event.type} - ${event.id}`,
      );

      return {
        success: true,
        eventType: event.type,
        eventId: event.id,
        message: 'Event processed successfully',
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error(
        `Webhook processing failed after ${processingTime}ms:`,
        {
          eventId: event.id,
          eventType: event.type,
          error: error.message,
          stack: error.stack,
          ipAddress,
          userAgent,
        },
      );

      // Mark event as processed with error
      if (event.id) {
        await this.webhookEventService.markEventAsProcessed(
          event.id,
          error.message,
        );
      }

      // Re-throw for proper HTTP response
      throw error;
    }
  }

  /**
   * Process webhook events with comprehensive error handling
   */
  private async processWebhookEvent(event: Stripe.Event): Promise<void> {
    const { type, data } = event;
    const object = data.object;

    this.logger.log(`Processing event: ${type} - ${event.id}`);

    try {
      switch (type) {
        // Critical Payment Intent Events
        case 'payment_intent.succeeded':
          await this.handlePaymentIntentSucceeded(
            object as Stripe.PaymentIntent,
          );
          break;

        case 'payment_intent.payment_failed':
          await this.handlePaymentIntentFailed(object as Stripe.PaymentIntent);
          break;

        case 'payment_intent.canceled':
          await this.handlePaymentIntentCanceled(
            object as Stripe.PaymentIntent,
          );
          break;

        case 'payment_intent.requires_action':
          await this.handlePaymentIntentRequiresAction(
            object as Stripe.PaymentIntent,
          );
          break;

        // Critical Charge Events
        case 'charge.succeeded':
          await this.handleChargeSucceeded(object as Stripe.Charge);
          break;

        case 'charge.failed':
          await this.handleChargeFailed(object as Stripe.Charge);
          break;

        case 'charge.refunded':
          await this.handleChargeRefunded(object as Stripe.Charge);
          break;

        case 'charge.dispute.created':
          await this.handleDisputeCreated(object as Stripe.Dispute);
          break;

        // Critical Transfer Events (for Connect)
        case 'transfer.created':
          await this.handleTransferCreated(object as Stripe.Transfer);
          break;

        // Note: transfer.failed and transfer.paid are not standard Stripe event types
        // These would typically be handled through different event types
        // case 'transfer.failed':
        //   await this.handleTransferFailed(object as Stripe.Transfer);
        //   break;

        // case 'transfer.paid':
        //   await this.handleTransferPaid(object as Stripe.Transfer);
        //   break;

        // Critical Payout Events
        case 'payout.created':
          await this.handlePayoutCreated(object as Stripe.Payout);
          break;

        case 'payout.failed':
          await this.handlePayoutFailed(object as Stripe.Payout);
          break;

        case 'payout.paid':
          await this.handlePayoutPaid(object as Stripe.Payout);
          break;

        // Invoice Events
        case 'invoice.payment_succeeded':
          await this.handleInvoicePaymentSucceeded(object as Stripe.Invoice);
          break;

        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(object as Stripe.Invoice);
          break;

        default:
          this.logger.warn(`Unhandled event type: ${type}`);
          break;
      }
    } catch (error) {
      this.logger.error(`Error processing event ${type} - ${event.id}:`, error);

      // Create admin notification for processing errors
      await this.adminNotificationsService.createAdminNotification({
        title: 'Webhook Processing Error',
        message: `Failed to process ${type} event ${event.id}: ${error.message}`,
        type: AdminNotificationType.ERROR,
        priority: AdminNotificationPriority.HIGH,
        category: AdminNotificationCategory.PAYMENT,
      });

      throw error;
    }
  }

  // Enhanced Event Handlers
  private async handlePaymentIntentSucceeded(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    this.logger.log(
      `Processing successful payment intent: ${paymentIntent.id}`,
    );

    try {
      // Update transaction status
      await this.updateTransactionFromPaymentIntent(
        paymentIntent.id,
        TransactionStatus.COMPLETED,
      );

      // Update booking status
      await this.updateBookingFromPaymentIntent(
        paymentIntent,
        'payment_confirmed',
      );

      // Update wallet balance for recipient
      if (paymentIntent.metadata?.booking_id) {
        const booking = await this.bookingsRepository.findOne({
          where: { id: paymentIntent.metadata.booking_id },
        });

        if (booking && booking.ownerId) {
          // Update wallet balance using existing method
          const wallet = await this.walletsService.findByUserId(
            booking.ownerId,
          );
          if (wallet) {
            await this.walletsService.addAvailableFunds(
              wallet.id,
              paymentIntent.amount / 100,
            );
          }
        }
      }

      // Create admin notification
      await this.adminNotificationsService.createAdminNotification({
        title: 'Payment Successful',
        message: `Payment Intent ${paymentIntent.id} succeeded. Amount: £${(paymentIntent.amount / 100).toFixed(2)}`,
        type: AdminNotificationType.SUCCESS,
        priority: AdminNotificationPriority.MEDIUM,
        category: AdminNotificationCategory.PAYMENT,
      });
    } catch (error) {
      this.logger.error(`Error processing payment intent succeeded:`, error);
      throw error;
    }
  }

  private async handlePaymentIntentFailed(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    this.logger.log(`Processing failed payment intent: ${paymentIntent.id}`);

    try {
      // Update transaction status
      await this.updateTransactionFromPaymentIntent(
        paymentIntent.id,
        TransactionStatus.FAILED,
      );

      // Update booking status
      await this.updateBookingFromPaymentIntent(
        paymentIntent,
        'payment_failed',
      );

      // Create admin notification
      const failureReason =
        paymentIntent.last_payment_error?.message || 'Unknown reason';
      await this.adminNotificationsService.createAdminNotification({
        title: 'Payment Failed',
        message: `Payment Intent ${paymentIntent.id} failed. Reason: ${failureReason}`,
        type: AdminNotificationType.ERROR,
        priority: AdminNotificationPriority.HIGH,
        category: AdminNotificationCategory.PAYMENT,
      });
    } catch (error) {
      this.logger.error(`Error processing payment intent failed:`, error);
      throw error;
    }
  }

  private async handleTransferCreated(
    transfer: Stripe.Transfer,
  ): Promise<void> {
    this.logger.log(`Processing transfer created: ${transfer.id}`);

    try {
      // Update withdrawal transaction if it exists
      if (transfer.metadata?.transaction_id) {
        const transaction = await this.transactionsRepository.findOne({
          where: { id: transfer.metadata.transaction_id },
        });

        if (transaction && transaction.type === TransactionType.WITHDRAWAL) {
          transaction.externalReference = transfer.id;
          transaction.status = TransactionStatus.PROCESSING;
          await this.transactionsRepository.save(transaction);
        }
      }

      // Create admin notification
      await this.adminNotificationsService.createAdminNotification({
        title: 'Transfer Created',
        message: `Transfer ${transfer.id} created. Amount: £${(transfer.amount / 100).toFixed(2)} to ${transfer.destination}`,
        type: AdminNotificationType.INFO,
        priority: AdminNotificationPriority.MEDIUM,
        category: AdminNotificationCategory.PAYMENT,
      });
    } catch (error) {
      this.logger.error(`Error processing transfer created:`, error);
      throw error;
    }
  }

  private async handleTransferFailed(transfer: Stripe.Transfer): Promise<void> {
    this.logger.log(`Processing transfer failed: ${transfer.id}`);

    try {
      // Update withdrawal transaction if it exists
      if (transfer.metadata?.transaction_id) {
        const transaction = await this.transactionsRepository.findOne({
          where: { id: transfer.metadata.transaction_id },
        });

        if (transaction && transaction.type === TransactionType.WITHDRAWAL) {
          transaction.status = TransactionStatus.FAILED;
          transaction.description = `${transaction.description} - Transfer failed`;
          await this.transactionsRepository.save(transaction);
        }
      }

      // Create admin notification
      await this.adminNotificationsService.createAdminNotification({
        title: 'Transfer Failed',
        message: `Transfer ${transfer.id} failed. Amount: £${(transfer.amount / 100).toFixed(2)}`,
        type: AdminNotificationType.ERROR,
        priority: AdminNotificationPriority.URGENT,
        category: AdminNotificationCategory.PAYMENT,
      });
    } catch (error) {
      this.logger.error(`Error processing transfer failed:`, error);
      throw error;
    }
  }

  private async handleTransferPaid(transfer: Stripe.Transfer): Promise<void> {
    this.logger.log(`Processing transfer paid: ${transfer.id}`);

    try {
      // Update withdrawal transaction if it exists
      if (transfer.metadata?.transaction_id) {
        const transaction = await this.transactionsRepository.findOne({
          where: { id: transfer.metadata.transaction_id },
        });

        if (transaction && transaction.type === TransactionType.WITHDRAWAL) {
          transaction.status = TransactionStatus.COMPLETED;
          transaction.processedAt = new Date();
          await this.transactionsRepository.save(transaction);
        }
      }

      // Create admin notification
      await this.adminNotificationsService.createAdminNotification({
        title: 'Transfer Paid',
        message: `Transfer ${transfer.id} paid successfully. Amount: £${(transfer.amount / 100).toFixed(2)}`,
        type: AdminNotificationType.SUCCESS,
        priority: AdminNotificationPriority.MEDIUM,
        category: AdminNotificationCategory.PAYMENT,
      });
    } catch (error) {
      this.logger.error(`Error processing transfer paid:`, error);
      throw error;
    }
  }

  // Additional event handlers (implementations similar to above)
  private async handlePaymentIntentCanceled(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    await this.updateTransactionFromPaymentIntent(
      paymentIntent.id,
      TransactionStatus.CANCELLED,
    );

    await this.adminNotificationsService.createAdminNotification({
      title: 'Payment Canceled',
      message: `Payment Intent ${paymentIntent.id} was canceled`,
      type: AdminNotificationType.WARNING,
      priority: AdminNotificationPriority.MEDIUM,
      category: AdminNotificationCategory.PAYMENT,
    });
  }

  private async handlePaymentIntentRequiresAction(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    await this.updateTransactionFromPaymentIntent(
      paymentIntent.id,
      TransactionStatus.PENDING,
    );

    await this.adminNotificationsService.createAdminNotification({
      title: 'Payment Requires Action',
      message: `Payment Intent ${paymentIntent.id} requires additional action (3D Secure)`,
      type: AdminNotificationType.INFO,
      priority: AdminNotificationPriority.MEDIUM,
      category: AdminNotificationCategory.PAYMENT,
    });
  }

  private async handleChargeSucceeded(charge: Stripe.Charge): Promise<void> {
    await this.adminNotificationsService.createAdminNotification({
      title: 'Charge Successful',
      message: `Charge ${charge.id} succeeded. Amount: £${(charge.amount / 100).toFixed(2)}`,
      type: AdminNotificationType.SUCCESS,
      priority: AdminNotificationPriority.LOW,
      category: AdminNotificationCategory.PAYMENT,
    });
  }

  private async handleChargeFailed(charge: Stripe.Charge): Promise<void> {
    await this.adminNotificationsService.createAdminNotification({
      title: 'Charge Failed',
      message: `Charge ${charge.id} failed. Reason: ${charge.failure_message || 'Unknown'}`,
      type: AdminNotificationType.ERROR,
      priority: AdminNotificationPriority.HIGH,
      category: AdminNotificationCategory.PAYMENT,
    });
  }

  private async handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
    await this.adminNotificationsService.createAdminNotification({
      title: 'Charge Refunded',
      message: `Charge ${charge.id} refunded. Amount: £${(charge.amount_refunded / 100).toFixed(2)}`,
      type: AdminNotificationType.INFO,
      priority: AdminNotificationPriority.MEDIUM,
      category: AdminNotificationCategory.PAYMENT,
    });
  }

  private async handleDisputeCreated(dispute: Stripe.Dispute): Promise<void> {
    await this.adminNotificationsService.createAdminNotification({
      title: 'Dispute Created',
      message: `Dispute ${dispute.id} created on charge ${dispute.charge}. Amount: £${(dispute.amount / 100).toFixed(2)}`,
      type: AdminNotificationType.WARNING,
      priority: AdminNotificationPriority.URGENT,
      category: AdminNotificationCategory.DISPUTE,
    });
  }

  private async handlePayoutCreated(payout: Stripe.Payout): Promise<void> {
    await this.adminNotificationsService.createAdminNotification({
      title: 'Payout Created',
      message: `Payout ${payout.id} created. Amount: £${(payout.amount / 100).toFixed(2)}`,
      type: AdminNotificationType.INFO,
      priority: AdminNotificationPriority.MEDIUM,
      category: AdminNotificationCategory.PAYMENT,
    });
  }

  private async handlePayoutFailed(payout: Stripe.Payout): Promise<void> {
    await this.adminNotificationsService.createAdminNotification({
      title: 'Payout Failed',
      message: `Payout ${payout.id} failed. Amount: £${(payout.amount / 100).toFixed(2)}`,
      type: AdminNotificationType.ERROR,
      priority: AdminNotificationPriority.URGENT,
      category: AdminNotificationCategory.PAYMENT,
    });
  }

  private async handlePayoutPaid(payout: Stripe.Payout): Promise<void> {
    await this.adminNotificationsService.createAdminNotification({
      title: 'Payout Paid',
      message: `Payout ${payout.id} paid successfully. Amount: £${(payout.amount / 100).toFixed(2)}`,
      type: AdminNotificationType.SUCCESS,
      priority: AdminNotificationPriority.MEDIUM,
      category: AdminNotificationCategory.PAYMENT,
    });
  }

  private async handleInvoicePaymentSucceeded(
    invoice: Stripe.Invoice,
  ): Promise<void> {
    await this.adminNotificationsService.createAdminNotification({
      title: 'Invoice Payment Successful',
      message: `Invoice ${invoice.id} payment succeeded. Amount: £${((invoice.amount_paid || 0) / 100).toFixed(2)}`,
      type: AdminNotificationType.SUCCESS,
      priority: AdminNotificationPriority.MEDIUM,
      category: AdminNotificationCategory.PAYMENT,
    });
  }

  private async handleInvoicePaymentFailed(
    invoice: Stripe.Invoice,
  ): Promise<void> {
    await this.adminNotificationsService.createAdminNotification({
      title: 'Invoice Payment Failed',
      message: `Invoice ${invoice.id} payment failed`,
      type: AdminNotificationType.ERROR,
      priority: AdminNotificationPriority.HIGH,
      category: AdminNotificationCategory.PAYMENT,
    });
  }

  // Utility methods
  private async updateTransactionFromPaymentIntent(
    paymentIntentId: string,
    status: TransactionStatus,
  ): Promise<void> {
    try {
      const transaction = await this.transactionsRepository.findOne({
        where: { externalReference: paymentIntentId },
      });

      if (transaction) {
        transaction.status = status;
        transaction.processedAt = new Date();
        await this.transactionsRepository.save(transaction);

        this.logger.log(`Transaction ${transaction.id} updated to ${status}`);
      } else {
        this.logger.warn(
          `Transaction not found for Payment Intent: ${paymentIntentId}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error updating transaction for Payment Intent ${paymentIntentId}:`,
        error,
      );
      throw error;
    }
  }

  private async updateBookingFromPaymentIntent(
    paymentIntent: Stripe.PaymentIntent,
    paymentStatus: string,
  ): Promise<void> {
    try {
      const bookingId = paymentIntent.metadata?.booking_id;

      if (bookingId) {
        const booking = await this.bookingsRepository.findOne({
          where: { id: bookingId },
        });

        if (booking) {
          (booking as any).paymentStatus = paymentStatus;
          await this.bookingsRepository.save(booking);

          this.logger.log(`Booking ${bookingId} updated to ${paymentStatus}`);
        } else {
          this.logger.warn(`Booking not found: ${bookingId}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error updating booking for Payment Intent:`, error);
      throw error;
    }
  }
}
