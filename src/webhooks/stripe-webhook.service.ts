import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { AdminNotificationsService } from '../admin/admin-notifications.service';
import {
  NotificationCategory as AdminNotificationCategory,
  NotificationPriority as AdminNotificationPriority,
  NotificationType as AdminNotificationType,
} from '../admin/dto/admin-notifications.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { TransactionStatus } from '../transactions/enums/transaction-status.enum';
import { PaymentService } from '../payments/payment.service';

@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name);
  private stripe: any;

  constructor(
    @InjectRepository(Transaction)
    private transactionsRepository: Repository<Transaction>,
    @InjectRepository(Booking)
    private bookingsRepository: Repository<Booking>,
    private configService: ConfigService,
    private paymentService: PaymentService,
    private adminNotificationsService: AdminNotificationsService,
  ) {
    // Initialiser Stripe
    const Stripe = require('stripe');
    this.stripe = new Stripe(this.configService.get('STRIPE_SECRET_KEY'));
  }

  /**
   * Traite un webhook Stripe
   */
  async handleWebhook(
    rawBody: Buffer,
    signature: string,
  ): Promise<{ eventType: string; eventId: string }> {
    let event: any;

    try {
      // Vérifier la signature du webhook
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.configService.get('STRIPE_WEBHOOK_SECRET'),
      );
    } catch (error) {
      this.logger.error('Webhook signature verification error:', error);
      throw new BadRequestException(
        `Webhook signature error: ${error.message}`,
      );
    }

    this.logger.log(`Webhook received: ${event.type} - ID: ${event.id}`);

    try {
      // Traiter l'événement selon son type
      await this.processWebhookEvent(event);

      return {
        eventType: event.type,
        eventId: event.id,
      };
    } catch (error) {
      this.logger.error(
        `Error processing event ${event.type}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Traite les différents types d'événements Stripe
   */
  private async processWebhookEvent(event: any): Promise<void> {
    const { type, data } = event;
    const object = data.object;

    switch (type) {
      // Événements Payment Intent
      case 'payment_intent.succeeded':
        await this.handlePaymentIntentSucceeded(object);
        break;

      case 'payment_intent.payment_failed':
        await this.handlePaymentIntentFailed(object);
        break;

      case 'payment_intent.canceled':
        await this.handlePaymentIntentCanceled(object);
        break;

      case 'payment_intent.amount_capturable_updated':
        await this.handlePaymentIntentAmountCapturableUpdated(object);
        break;

      case 'payment_intent.partially_funded':
        await this.handlePaymentIntentPartiallyFunded(object);
        break;

      case 'payment_intent.processing':
        await this.handlePaymentIntentProcessing(object);
        break;

      case 'payment_intent.requires_action':
        await this.handlePaymentIntentRequiresAction(object);
        break;

      case 'payment_intent.created':
        await this.handlePaymentIntentCreated(object);
        break;

      // Événements Charge
      case 'charge.succeeded':
        await this.handleChargeSucceeded(object);
        break;

      case 'charge.failed':
        await this.handleChargeFailed(object);
        break;

      case 'charge.captured':
        await this.handleChargeCaptured(object);
        break;

      case 'charge.refunded':
        await this.handleChargeRefunded(object);
        break;

      case 'charge.updated':
        await this.handleChargeUpdated(object);
        break;

      case 'charge.pending':
        await this.handleChargePending(object);
        break;

      case 'charge.expired':
        await this.handleChargeExpired(object);
        break;

      // Événements Dispute
      case 'charge.dispute.created':
        await this.handleDisputeCreated(object);
        break;

      case 'charge.dispute.updated':
        await this.handleDisputeUpdated(object);
        break;

      case 'charge.dispute.closed':
        await this.handleDisputeClosed(object);
        break;

      case 'charge.dispute.funds_withdrawn':
        await this.handleDisputeFundsWithdrawn(object);
        break;

      case 'charge.dispute.funds_reinstated':
        await this.handleDisputeFundsReinstated(object);
        break;

      // Événements Invoice (si utilisés)
      case 'invoice.payment_succeeded':
        await this.handleInvoicePaymentSucceeded(object);
        break;

      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(object);
        break;

      default:
        this.logger.warn(`Unhandled event: ${type}`);
        break;
    }
  }

  // Gestionnaires d'événements Payment Intent
  private async handlePaymentIntentSucceeded(
    paymentIntent: any,
  ): Promise<void> {
    this.logger.log(`Payment Intent succeeded: ${paymentIntent.id}`);

    await this.updateTransactionFromPaymentIntent(
      paymentIntent.id,
      TransactionStatus.COMPLETED,
    );

    // Mettre à jour la réservation si applicable
    await this.updateBookingFromPaymentIntent(
      paymentIntent,
      'payment_confirmed',
    );

    // Créer une notification admin pour paiement réussi
    await this.adminNotificationsService.createAdminNotification({
      title: 'Payment confirmed',
      message: `Payment Intent ${paymentIntent.id} confirmed for booking ${paymentIntent.metadata?.booking_id ?? 'N/A'}. Amount: ${(paymentIntent.amount_received ?? paymentIntent.amount) / 100} ${paymentIntent.currency?.toUpperCase()}`,
      type: AdminNotificationType.SUCCESS,
      priority: AdminNotificationPriority.MEDIUM,
      category: AdminNotificationCategory.PAYMENT,
    });
  }

  private async handlePaymentIntentFailed(paymentIntent: any): Promise<void> {
    this.logger.log(`Payment Intent failed: ${paymentIntent.id}`);

    await this.updateTransactionFromPaymentIntent(
      paymentIntent.id,
      TransactionStatus.FAILED,
    );

    // Mettre à jour la réservation si applicable
    await this.updateBookingFromPaymentIntent(paymentIntent, 'payment_failed');

    // Créer notification admin pour échec de paiement
    await this.adminNotificationsService.createAdminNotification({
      title: 'Payment failed',
      message: `Payment Intent ${paymentIntent.id} failed. Reason: ${paymentIntent.last_payment_error?.message ?? 'Unknown'}. Booking: ${paymentIntent.metadata?.booking_id ?? 'N/A'}`,
      type: AdminNotificationType.ERROR,
      priority: AdminNotificationPriority.HIGH,
      category: AdminNotificationCategory.PAYMENT,
    });
  }

  private async handlePaymentIntentCanceled(paymentIntent: any): Promise<void> {
    this.logger.log(`Payment Intent canceled: ${paymentIntent.id}`);

    await this.updateTransactionFromPaymentIntent(
      paymentIntent.id,
      TransactionStatus.CANCELLED,
    );

    // Mettre à jour la réservation si applicable
    await this.updateBookingFromPaymentIntent(
      paymentIntent,
      'payment_cancelled',
    );
  }

  private async handlePaymentIntentAmountCapturableUpdated(
    paymentIntent: any,
  ): Promise<void> {
    this.logger.log(
      `Capturable amount updated for Payment Intent: ${paymentIntent.id}`,
    );
    // Logique spécifique si nécessaire
  }

  private async handlePaymentIntentPartiallyFunded(
    paymentIntent: any,
  ): Promise<void> {
    this.logger.log(
      `Payment Intent partially funded: ${paymentIntent.id}`,
    );
    // Logique spécifique si nécessaire
  }

  private async handlePaymentIntentProcessing(
    paymentIntent: any,
  ): Promise<void> {
    this.logger.log(
      `Payment Intent processing: ${paymentIntent.id}`,
    );

    await this.updateTransactionFromPaymentIntent(
      paymentIntent.id,
      TransactionStatus.PROCESSING,
    );
  }

  private async handlePaymentIntentRequiresAction(
    paymentIntent: any,
  ): Promise<void> {
    this.logger.log(`Payment Intent requires action: ${paymentIntent.id}`);
    // Logique pour notifier l'utilisateur si nécessaire
  }

  private async handlePaymentIntentCreated(paymentIntent: any): Promise<void> {
    this.logger.log(`Payment Intent created: ${paymentIntent.id}`);
    // Logique spécifique si nécessaire
  }

  // Gestionnaires d'événements Charge
  private async handleChargeSucceeded(charge: any): Promise<void> {
    this.logger.log(`Charge succeeded: ${charge.id}`);
    // Notification admin pour charge réussie
    await this.adminNotificationsService.createAdminNotification({
      title: 'Charge succeeded',
      message: `Charge ${charge.id} succeeded. Amount: ${charge.amount / 100} ${charge.currency?.toUpperCase()} — PaymentIntent: ${charge.payment_intent ?? 'N/A'}`,
      type: AdminNotificationType.SUCCESS,
      priority: AdminNotificationPriority.MEDIUM,
      category: AdminNotificationCategory.PAYMENT,
    });
  }

  private async handleChargeFailed(charge: any): Promise<void> {
    this.logger.log(`Charge failed: ${charge.id}`);
    await this.adminNotificationsService.createAdminNotification({
      title: 'Charge failed',
      message: `Charge ${charge.id} failed. Reason: ${charge.failure_message ?? 'Unknown'} — Code: ${charge.failure_code ?? 'N/A'}`,
      type: AdminNotificationType.ERROR,
      priority: AdminNotificationPriority.HIGH,
      category: AdminNotificationCategory.PAYMENT,
    });
  }

  private async handleChargeCaptured(charge: any): Promise<void> {
    this.logger.log(`Charge captured: ${charge.id}`);
    await this.adminNotificationsService.createAdminNotification({
      title: 'Charge captured',
      message: `Charge ${charge.id} captured. Amount: ${charge.amount_captured / 100} ${charge.currency?.toUpperCase()}`,
      type: AdminNotificationType.INFO,
      priority: AdminNotificationPriority.MEDIUM,
      category: AdminNotificationCategory.PAYMENT,
    });
  }

  private async handleChargeRefunded(charge: any): Promise<void> {
    this.logger.log(`Charge refunded: ${charge.id}`);
    const totalRefunded = (charge.amount_refunded ?? 0) / 100;
    await this.adminNotificationsService.createAdminNotification({
      title: 'Refund processed',
      message: `Charge ${charge.id} refunded. Refunded amount: ${totalRefunded} ${charge.currency?.toUpperCase()}`,
      type: AdminNotificationType.INFO,
      priority: AdminNotificationPriority.HIGH,
      category: AdminNotificationCategory.PAYMENT,
    });
  }

  private async handleChargeUpdated(charge: any): Promise<void> {
    this.logger.log(`Charge updated: ${charge.id}`);
    // Logique spécifique si nécessaire
  }

  private async handleChargePending(charge: any): Promise<void> {
    this.logger.log(`Charge pending: ${charge.id}`);
    await this.adminNotificationsService.createAdminNotification({
      title: 'Charge pending',
      message: `Charge ${charge.id} pending authorization/capture.`,
      type: AdminNotificationType.INFO,
      priority: AdminNotificationPriority.MEDIUM,
      category: AdminNotificationCategory.PAYMENT,
    });
  }

  private async handleChargeExpired(charge: any): Promise<void> {
    this.logger.log(`Charge expired: ${charge.id}`);
    await this.adminNotificationsService.createAdminNotification({
      title: 'Charge expired',
      message: `Charge ${charge.id} expired — no capture performed in time.`,
      type: AdminNotificationType.WARNING,
      priority: AdminNotificationPriority.HIGH,
      category: AdminNotificationCategory.PAYMENT,
    });
  }

  // Gestionnaires d'événements Dispute
  private async handleDisputeCreated(dispute: any): Promise<void> {
    this.logger.log(`Dispute created: ${dispute.id}`);
    await this.adminNotificationsService.createAdminNotification({
      title: 'Dispute initiated',
      message: `Dispute ${dispute.id} created on charge ${dispute.charge}. Contested amount: ${(dispute.amount ?? 0) / 100} ${dispute.currency?.toUpperCase()}`,
      type: AdminNotificationType.WARNING,
      priority: AdminNotificationPriority.URGENT,
      category: AdminNotificationCategory.DISPUTE,
    });
  }

  private async handleDisputeUpdated(dispute: any): Promise<void> {
    this.logger.log(`Dispute updated: ${dispute.id}`);
    await this.adminNotificationsService.createAdminNotification({
      title: 'Dispute updated',
      message: `Dispute ${dispute.id} updated. Status: ${dispute.status}`,
      type: AdminNotificationType.INFO,
      priority: AdminNotificationPriority.HIGH,
      category: AdminNotificationCategory.DISPUTE,
    });
  }

  private async handleDisputeClosed(dispute: any): Promise<void> {
    this.logger.log(`Dispute closed: ${dispute.id}`);
    await this.adminNotificationsService.createAdminNotification({
      title: 'Dispute closed',
      message: `Dispute ${dispute.id} closed. Result: ${dispute.status}`,
      type: AdminNotificationType.SUCCESS,
      priority: AdminNotificationPriority.MEDIUM,
      category: AdminNotificationCategory.DISPUTE,
    });
  }

  private async handleDisputeFundsWithdrawn(dispute: any): Promise<void> {
    this.logger.log(`Funds withdrawn for dispute: ${dispute.id}`);
    await this.adminNotificationsService.createAdminNotification({
      title: 'Funds withdrawn (dispute)',
      message: `Funds withdrawn for dispute ${dispute.id}. Amount: ${(dispute.amount ?? 0) / 100} ${dispute.currency?.toUpperCase()}`,
      type: AdminNotificationType.ERROR,
      priority: AdminNotificationPriority.URGENT,
      category: AdminNotificationCategory.DISPUTE,
    });
  }

  private async handleDisputeFundsReinstated(dispute: any): Promise<void> {
    this.logger.log(`Funds reinstated for dispute: ${dispute.id}`);
    await this.adminNotificationsService.createAdminNotification({
      title: 'Funds reinstated (dispute)',
      message: `Funds reinstated for dispute ${dispute.id}. Amount: ${(dispute.amount ?? 0) / 100} ${dispute.currency?.toUpperCase()}`,
      type: AdminNotificationType.SUCCESS,
      priority: AdminNotificationPriority.HIGH,
      category: AdminNotificationCategory.DISPUTE,
    });
  }

  // Gestionnaires d'événements Invoice
  private async handleInvoicePaymentSucceeded(invoice: any): Promise<void> {
    this.logger.log(`Invoice payment succeeded: ${invoice.id}`);
    await this.adminNotificationsService.createAdminNotification({
      title: 'Invoice payment succeeded',
      message: `Invoice ${invoice.id} paid successfully. Amount: ${(invoice.amount_paid ?? invoice.amount_due ?? 0) / 100} ${(invoice.currency ?? 'eur').toUpperCase()}`,
      type: AdminNotificationType.SUCCESS,
      priority: AdminNotificationPriority.MEDIUM,
      category: AdminNotificationCategory.PAYMENT,
    });
  }

  private async handleInvoicePaymentFailed(invoice: any): Promise<void> {
    this.logger.log(`Invoice payment failed: ${invoice.id}`);
    await this.adminNotificationsService.createAdminNotification({
      title: 'Invoice payment failed',
      message: `Invoice ${invoice.id} payment failed. Customer: ${invoice.customer ?? 'N/A'}`,
      type: AdminNotificationType.ERROR,
      priority: AdminNotificationPriority.HIGH,
      category: AdminNotificationCategory.PAYMENT,
    });
  }

  // Méthodes utilitaires
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

        this.logger.log(`Transaction ${transaction.id} updated: ${status}`);
      } else {
        this.logger.warn(
          `Transaction not found for Payment Intent: ${paymentIntentId}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error updating transaction for ${paymentIntentId}:`,
        error,
      );
    }
  }

  private async updateBookingFromPaymentIntent(
    paymentIntent: any,
    paymentStatus: string,
  ): Promise<void> {
    try {
      const bookingId = paymentIntent.metadata?.booking_id;

      if (bookingId) {
        const booking = await this.bookingsRepository.findOne({
          where: { id: bookingId },
        });

        if (booking) {
          // Mettre à jour le statut de paiement de la réservation
          // Note: Vous devrez peut-être ajouter ce champ à l'entité Booking
          (booking as any).paymentStatus = paymentStatus;
          await this.bookingsRepository.save(booking);

          this.logger.log(
            `Booking ${bookingId} updated: ${paymentStatus}`,
          );
        } else {
          this.logger.warn(`Booking not found: ${bookingId}`);
        }
      }
    } catch (error) {
      this.logger.error(
        `Error updating booking:`,
        error,
      );
    }
  }
}
