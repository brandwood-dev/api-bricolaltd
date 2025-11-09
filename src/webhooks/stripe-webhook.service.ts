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
  async handleWebhook(rawBody: Buffer, signature: string): Promise<{ eventType: string; eventId: string }> {
    let event: any;

    try {
      // Vérifier la signature du webhook
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.configService.get('STRIPE_WEBHOOK_SECRET')
      );
    } catch (error) {
      this.logger.error('Erreur de vérification de signature webhook:', error);
      throw new BadRequestException(`Erreur de signature webhook: ${error.message}`);
    }

    this.logger.log(`Webhook reçu: ${event.type} - ID: ${event.id}`);

    try {
      // Traiter l'événement selon son type
      await this.processWebhookEvent(event);
      
      return {
        eventType: event.type,
        eventId: event.id
      };
    } catch (error) {
      this.logger.error(`Erreur lors du traitement de l'événement ${event.type}:`, error);
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
        this.logger.warn(`Événement non géré: ${type}`);
        break;
    }
  }

  // Gestionnaires d'événements Payment Intent
  private async handlePaymentIntentSucceeded(paymentIntent: any): Promise<void> {
    this.logger.log(`Payment Intent réussi: ${paymentIntent.id}`);
    
    await this.updateTransactionFromPaymentIntent(
      paymentIntent.id,
      TransactionStatus.COMPLETED
    );

    // Mettre à jour la réservation si applicable
    await this.updateBookingFromPaymentIntent(paymentIntent, 'payment_confirmed');

    // Créer une notification admin pour paiement réussi
    await this.adminNotificationsService.createAdminNotification({
      title: 'Paiement confirmé',
      message: `Payment Intent ${paymentIntent.id} confirmé pour réservation ${paymentIntent.metadata?.booking_id ?? 'N/A'}. Montant: ${(paymentIntent.amount_received ?? paymentIntent.amount)/100} ${paymentIntent.currency?.toUpperCase()}`,
      type: AdminNotificationType.SUCCESS,
      priority: AdminNotificationPriority.MEDIUM,
      category: AdminNotificationCategory.PAYMENT,
    });
  }

  private async handlePaymentIntentFailed(paymentIntent: any): Promise<void> {
    this.logger.log(`Payment Intent échoué: ${paymentIntent.id}`);
    
    await this.updateTransactionFromPaymentIntent(
      paymentIntent.id,
      TransactionStatus.FAILED
    );

    // Mettre à jour la réservation si applicable
    await this.updateBookingFromPaymentIntent(paymentIntent, 'payment_failed');

    // Créer notification admin pour échec de paiement
    await this.adminNotificationsService.createAdminNotification({
      title: 'Échec de paiement',
      message: `Payment Intent ${paymentIntent.id} échoué. Raison: ${paymentIntent.last_payment_error?.message ?? 'Inconnue'}. Réservation: ${paymentIntent.metadata?.booking_id ?? 'N/A'}`,
      type: AdminNotificationType.ERROR,
      priority: AdminNotificationPriority.HIGH,
      category: AdminNotificationCategory.PAYMENT,
    });
  }

  private async handlePaymentIntentCanceled(paymentIntent: any): Promise<void> {
    this.logger.log(`Payment Intent annulé: ${paymentIntent.id}`);
    
    await this.updateTransactionFromPaymentIntent(
      paymentIntent.id,
      TransactionStatus.CANCELLED
    );

    // Mettre à jour la réservation si applicable
    await this.updateBookingFromPaymentIntent(paymentIntent, 'payment_cancelled');
  }

  private async handlePaymentIntentAmountCapturableUpdated(paymentIntent: any): Promise<void> {
    this.logger.log(`Montant capturable mis à jour pour Payment Intent: ${paymentIntent.id}`);
    // Logique spécifique si nécessaire
  }

  private async handlePaymentIntentPartiallyFunded(paymentIntent: any): Promise<void> {
    this.logger.log(`Payment Intent partiellement financé: ${paymentIntent.id}`);
    // Logique spécifique si nécessaire
  }

  private async handlePaymentIntentProcessing(paymentIntent: any): Promise<void> {
    this.logger.log(`Payment Intent en cours de traitement: ${paymentIntent.id}`);
    
    await this.updateTransactionFromPaymentIntent(
      paymentIntent.id,
      TransactionStatus.PROCESSING
    );
  }

  private async handlePaymentIntentRequiresAction(paymentIntent: any): Promise<void> {
    this.logger.log(`Payment Intent nécessite une action: ${paymentIntent.id}`);
    // Logique pour notifier l'utilisateur si nécessaire
  }

  private async handlePaymentIntentCreated(paymentIntent: any): Promise<void> {
    this.logger.log(`Payment Intent créé: ${paymentIntent.id}`);
    // Logique spécifique si nécessaire
  }

  // Gestionnaires d'événements Charge
  private async handleChargeSucceeded(charge: any): Promise<void> {
    this.logger.log(`Charge réussi: ${charge.id}`);
    // Notification admin pour charge réussie
    await this.adminNotificationsService.createAdminNotification({
      title: 'Charge réussie',
      message: `Charge ${charge.id} réussie. Montant: ${charge.amount/100} ${charge.currency?.toUpperCase()} — PaymentIntent: ${charge.payment_intent ?? 'N/A'}`,
      type: AdminNotificationType.SUCCESS,
      priority: AdminNotificationPriority.MEDIUM,
      category: AdminNotificationCategory.PAYMENT,
    });
  }

  private async handleChargeFailed(charge: any): Promise<void> {
    this.logger.log(`Charge échoué: ${charge.id}`);
    await this.adminNotificationsService.createAdminNotification({
      title: 'Charge échouée',
      message: `Charge ${charge.id} échouée. Raison: ${charge.failure_message ?? 'Inconnue'} — Code: ${charge.failure_code ?? 'N/A'}`,
      type: AdminNotificationType.ERROR,
      priority: AdminNotificationPriority.HIGH,
      category: AdminNotificationCategory.PAYMENT,
    });
  }

  private async handleChargeCaptured(charge: any): Promise<void> {
    this.logger.log(`Charge capturé: ${charge.id}`);
    await this.adminNotificationsService.createAdminNotification({
      title: 'Charge capturée',
      message: `Charge ${charge.id} capturée. Montant: ${charge.amount_captured/100} ${charge.currency?.toUpperCase()}`,
      type: AdminNotificationType.INFO,
      priority: AdminNotificationPriority.MEDIUM,
      category: AdminNotificationCategory.PAYMENT,
    });
  }

  private async handleChargeRefunded(charge: any): Promise<void> {
    this.logger.log(`Charge remboursé: ${charge.id}`);
    const totalRefunded = (charge.amount_refunded ?? 0)/100;
    await this.adminNotificationsService.createAdminNotification({
      title: 'Remboursement traité',
      message: `Charge ${charge.id} remboursée. Montant remboursé: ${totalRefunded} ${charge.currency?.toUpperCase()}`,
      type: AdminNotificationType.INFO,
      priority: AdminNotificationPriority.HIGH,
      category: AdminNotificationCategory.PAYMENT,
    });
  }

  private async handleChargeUpdated(charge: any): Promise<void> {
    this.logger.log(`Charge mis à jour: ${charge.id}`);
    // Logique spécifique si nécessaire
  }

  private async handleChargePending(charge: any): Promise<void> {
    this.logger.log(`Charge en attente: ${charge.id}`);
    await this.adminNotificationsService.createAdminNotification({
      title: 'Charge en attente',
      message: `Charge ${charge.id} en attente d'autorisation/capture.`,
      type: AdminNotificationType.INFO,
      priority: AdminNotificationPriority.MEDIUM,
      category: AdminNotificationCategory.PAYMENT,
    });
  }

  private async handleChargeExpired(charge: any): Promise<void> {
    this.logger.log(`Charge expiré: ${charge.id}`);
    await this.adminNotificationsService.createAdminNotification({
      title: 'Charge expirée',
      message: `Charge ${charge.id} expirée — aucune capture effectuée à temps.`,
      type: AdminNotificationType.WARNING,
      priority: AdminNotificationPriority.HIGH,
      category: AdminNotificationCategory.PAYMENT,
    });
  }

  // Gestionnaires d'événements Dispute
  private async handleDisputeCreated(dispute: any): Promise<void> {
    this.logger.log(`Litige créé: ${dispute.id}`);
    await this.adminNotificationsService.createAdminNotification({
      title: 'Litige initié',
      message: `Litige ${dispute.id} créé sur charge ${dispute.charge}. Montant contesté: ${(dispute.amount ?? 0)/100} ${dispute.currency?.toUpperCase()}`,
      type: AdminNotificationType.WARNING,
      priority: AdminNotificationPriority.URGENT,
      category: AdminNotificationCategory.DISPUTE,
    });
  }

  private async handleDisputeUpdated(dispute: any): Promise<void> {
    this.logger.log(`Litige mis à jour: ${dispute.id}`);
    await this.adminNotificationsService.createAdminNotification({
      title: 'Litige mis à jour',
      message: `Litige ${dispute.id} mis à jour. Statut: ${dispute.status}`,
      type: AdminNotificationType.INFO,
      priority: AdminNotificationPriority.HIGH,
      category: AdminNotificationCategory.DISPUTE,
    });
  }

  private async handleDisputeClosed(dispute: any): Promise<void> {
    this.logger.log(`Litige fermé: ${dispute.id}`);
    await this.adminNotificationsService.createAdminNotification({
      title: 'Litige fermé',
      message: `Litige ${dispute.id} fermé. Résultat: ${dispute.status}`,
      type: AdminNotificationType.SUCCESS,
      priority: AdminNotificationPriority.MEDIUM,
      category: AdminNotificationCategory.DISPUTE,
    });
  }

  private async handleDisputeFundsWithdrawn(dispute: any): Promise<void> {
    this.logger.log(`Fonds retirés pour litige: ${dispute.id}`);
    await this.adminNotificationsService.createAdminNotification({
      title: 'Fonds retirés (litige)',
      message: `Fonds retirés pour litige ${dispute.id}. Montant: ${(dispute.amount ?? 0)/100} ${dispute.currency?.toUpperCase()}`,
      type: AdminNotificationType.ERROR,
      priority: AdminNotificationPriority.URGENT,
      category: AdminNotificationCategory.DISPUTE,
    });
  }

  private async handleDisputeFundsReinstated(dispute: any): Promise<void> {
    this.logger.log(`Fonds rétablis pour litige: ${dispute.id}`);
    await this.adminNotificationsService.createAdminNotification({
      title: 'Fonds rétablis (litige)',
      message: `Fonds rétablis pour litige ${dispute.id}. Montant: ${(dispute.amount ?? 0)/100} ${dispute.currency?.toUpperCase()}`,
      type: AdminNotificationType.SUCCESS,
      priority: AdminNotificationPriority.HIGH,
      category: AdminNotificationCategory.DISPUTE,
    });
  }

  // Gestionnaires d'événements Invoice
  private async handleInvoicePaymentSucceeded(invoice: any): Promise<void> {
    this.logger.log(`Paiement de facture réussi: ${invoice.id}`);
    await this.adminNotificationsService.createAdminNotification({
      title: 'Paiement facture réussi',
      message: `Facture ${invoice.id} payée avec succès. Montant: ${(invoice.amount_paid ?? invoice.amount_due ?? 0)/100} ${(invoice.currency ?? 'eur').toUpperCase()}`,
      type: AdminNotificationType.SUCCESS,
      priority: AdminNotificationPriority.MEDIUM,
      category: AdminNotificationCategory.PAYMENT,
    });
  }

  private async handleInvoicePaymentFailed(invoice: any): Promise<void> {
    this.logger.log(`Paiement de facture échoué: ${invoice.id}`);
    await this.adminNotificationsService.createAdminNotification({
      title: 'Paiement facture échoué',
      message: `Facture ${invoice.id} paiement échoué. Client: ${invoice.customer ?? 'N/A'}`,
      type: AdminNotificationType.ERROR,
      priority: AdminNotificationPriority.HIGH,
      category: AdminNotificationCategory.PAYMENT,
    });
  }

  // Méthodes utilitaires
  private async updateTransactionFromPaymentIntent(
    paymentIntentId: string,
    status: TransactionStatus
  ): Promise<void> {
    try {
      const transaction = await this.transactionsRepository.findOne({
        where: { externalReference: paymentIntentId }
      });

      if (transaction) {
        transaction.status = status;
        transaction.processedAt = new Date();
        await this.transactionsRepository.save(transaction);
        
        this.logger.log(`Transaction ${transaction.id} mise à jour: ${status}`);
      } else {
        this.logger.warn(`Transaction introuvable pour Payment Intent: ${paymentIntentId}`);
      }
    } catch (error) {
      this.logger.error(`Erreur lors de la mise à jour de la transaction pour ${paymentIntentId}:`, error);
    }
  }

  private async updateBookingFromPaymentIntent(
    paymentIntent: any,
    paymentStatus: string
  ): Promise<void> {
    try {
      const bookingId = paymentIntent.metadata?.booking_id;
      
      if (bookingId) {
        const booking = await this.bookingsRepository.findOne({
          where: { id: bookingId }
        });

        if (booking) {
          // Mettre à jour le statut de paiement de la réservation
          // Note: Vous devrez peut-être ajouter ce champ à l'entité Booking
          (booking as any).paymentStatus = paymentStatus;
          await this.bookingsRepository.save(booking);
          
          this.logger.log(`Réservation ${bookingId} mise à jour: ${paymentStatus}`);
        } else {
          this.logger.warn(`Réservation introuvable: ${bookingId}`);
        }
      }
    } catch (error) {
      this.logger.error(`Erreur lors de la mise à jour de la réservation:`, error);
    }
  }
}