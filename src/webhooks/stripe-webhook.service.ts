import { Injectable, Logger, BadRequestException } from '@nestjs/common';
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
  }

  private async handlePaymentIntentFailed(paymentIntent: any): Promise<void> {
    this.logger.log(`Payment Intent échoué: ${paymentIntent.id}`);
    
    await this.updateTransactionFromPaymentIntent(
      paymentIntent.id,
      TransactionStatus.FAILED
    );

    // Mettre à jour la réservation si applicable
    await this.updateBookingFromPaymentIntent(paymentIntent, 'payment_failed');
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
    // Logique spécifique pour les charges réussies
  }

  private async handleChargeFailed(charge: any): Promise<void> {
    this.logger.log(`Charge échoué: ${charge.id}`);
    // Logique spécifique pour les charges échouées
  }

  private async handleChargeCaptured(charge: any): Promise<void> {
    this.logger.log(`Charge capturé: ${charge.id}`);
    // Logique spécifique pour les charges capturées
  }

  private async handleChargeRefunded(charge: any): Promise<void> {
    this.logger.log(`Charge remboursé: ${charge.id}`);
    // Logique spécifique pour les remboursements
  }

  private async handleChargeUpdated(charge: any): Promise<void> {
    this.logger.log(`Charge mis à jour: ${charge.id}`);
    // Logique spécifique si nécessaire
  }

  private async handleChargePending(charge: any): Promise<void> {
    this.logger.log(`Charge en attente: ${charge.id}`);
    // Logique spécifique si nécessaire
  }

  private async handleChargeExpired(charge: any): Promise<void> {
    this.logger.log(`Charge expiré: ${charge.id}`);
    // Logique spécifique si nécessaire
  }

  // Gestionnaires d'événements Dispute
  private async handleDisputeCreated(dispute: any): Promise<void> {
    this.logger.log(`Litige créé: ${dispute.id}`);
    // Logique pour gérer les nouveaux litiges
  }

  private async handleDisputeUpdated(dispute: any): Promise<void> {
    this.logger.log(`Litige mis à jour: ${dispute.id}`);
    // Logique pour les mises à jour de litiges
  }

  private async handleDisputeClosed(dispute: any): Promise<void> {
    this.logger.log(`Litige fermé: ${dispute.id}`);
    // Logique pour les litiges fermés
  }

  private async handleDisputeFundsWithdrawn(dispute: any): Promise<void> {
    this.logger.log(`Fonds retirés pour litige: ${dispute.id}`);
    // Logique pour les retraits de fonds dus aux litiges
  }

  private async handleDisputeFundsReinstated(dispute: any): Promise<void> {
    this.logger.log(`Fonds rétablis pour litige: ${dispute.id}`);
    // Logique pour les rétablissements de fonds
  }

  // Gestionnaires d'événements Invoice
  private async handleInvoicePaymentSucceeded(invoice: any): Promise<void> {
    this.logger.log(`Paiement de facture réussi: ${invoice.id}`);
    // Logique spécifique si nécessaire
  }

  private async handleInvoicePaymentFailed(invoice: any): Promise<void> {
    this.logger.log(`Paiement de facture échoué: ${invoice.id}`);
    // Logique spécifique si nécessaire
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