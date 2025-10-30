import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import {
  DepositSetupData,
  DepositCaptureData,
  DepositCaptureResult,
} from '../interfaces/deposit-automation.interface';
import { DepositCaptureStatus } from '../enums/deposit-capture-status.enum';
import { DepositNotificationService } from './deposit-notification.service';

@Injectable()
export class StripeDepositService {
  private readonly logger = new Logger(StripeDepositService.name);
  private readonly stripe: Stripe;

  constructor(
    private configService: ConfigService,
    private depositNotificationService: DepositNotificationService,
  ) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    this.stripe = new Stripe(stripeSecretKey);
  }

  /**
   * Créer ou récupérer un customer Stripe
   */
  async createOrGetCustomer(email: string, name: string): Promise<string> {
    try {
      // Chercher un customer existant
      const existingCustomers = await this.stripe.customers.list({
        email: email,
        limit: 1,
      });

      if (existingCustomers.data.length > 0) {
        this.logger.log(
          `Customer existant trouvé: ${existingCustomers.data[0].id}`,
        );
        return existingCustomers.data[0].id;
      }

      // Créer un nouveau customer
      const customer = await this.stripe.customers.create({
        email: email,
        name: name,
        metadata: {
          source: 'bricola_deposit_automation',
        },
      });

      this.logger.log(`Nouveau customer créé: ${customer.id}`);
      return customer.id;
    } catch (error) {
      this.logger.error(
        `Erreur lors de la création/récupération du customer: ${error.message}`,
      );
      throw new Error(
        `Impossible de créer le customer Stripe: ${error.message}`,
      );
    }
  }

  /**
   * Créer un SetupIntent pour enregistrer une méthode de paiement
   */
  async createSetupIntent(
    customerId: string,
    bookingId: string,
  ): Promise<DepositSetupData> {
    try {
      const setupIntent = await this.stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
        usage: 'off_session',
        metadata: {
          booking_id: bookingId,
          purpose: 'deposit_automation',
        },
      });

      this.logger.log(
        `SetupIntent créé: ${setupIntent.id} pour booking: ${bookingId}`,
      );

      if (!setupIntent.client_secret) {
        throw new Error('Failed to create setup intent: client_secret is null');
      }

      return {
        customerId,
        setupIntentId: setupIntent.id,
        clientSecret: setupIntent.client_secret,
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la création du SetupIntent: ${error.message}`,
      );
      throw new Error(`Impossible de créer le SetupIntent: ${error.message}`);
    }
  }

  /**
   * Confirmer le SetupIntent et récupérer la méthode de paiement
   */
  async confirmSetupIntent(setupIntentId: string): Promise<{
    success: boolean;
    paymentMethodId?: string;
    error?: string;
  }> {
    try {
      const setupIntent =
        await this.stripe.setupIntents.retrieve(setupIntentId);

      if (setupIntent.status !== 'succeeded') {
        return {
          success: false,
          error: `SetupIntent non confirmé. Status: ${setupIntent.status}`,
        };
      }

      if (!setupIntent.payment_method) {
        return {
          success: false,
          error: 'Aucune méthode de paiement attachée au SetupIntent',
        };
      }

      const paymentMethodId =
        typeof setupIntent.payment_method === 'string'
          ? setupIntent.payment_method
          : setupIntent.payment_method.id;

      this.logger.log(
        `SetupIntent confirmé: ${setupIntentId}, PaymentMethod: ${paymentMethodId}`,
      );
      return {
        success: true,
        paymentMethodId,
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la confirmation du SetupIntent: ${error.message}`,
      );
      return {
        success: false,
        error: `Impossible de confirmer le SetupIntent: ${error.message}`,
      };
    }
  }

  /**
   * Capturer automatiquement la caution
   */
  async captureDeposit(
    captureData: DepositCaptureData,
  ): Promise<DepositCaptureResult> {
    try {
      this.logger.log(
        `Tentative de capture de caution pour booking: ${captureData.bookingId}`,
      );

      // Créer un PaymentIntent pour capturer la caution
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(captureData.amount * 100), // Convertir en centimes
        currency: captureData.currency.toLowerCase(),
        customer: captureData.customerId,
        payment_method: captureData.paymentMethodId,
        confirmation_method: 'manual',
        confirm: true,
        off_session: true, // Paiement sans interaction utilisateur
        metadata: {
          booking_id: captureData.bookingId,
          type: 'deposit_capture',
          amount: captureData.amount.toString(),
        },
        description: `Caution pour réservation ${captureData.bookingId}`,
      });

      if (paymentIntent.status === 'succeeded') {
        this.logger.log(`Caution capturée avec succès: ${paymentIntent.id}`);
        return {
          success: true,
          paymentIntentId: paymentIntent.id,
          status: DepositCaptureStatus.SUCCESS,
        };
      } else if (paymentIntent.status === 'requires_action') {
        // Authentification 3D Secure requise
        this.logger.warn(
          `Authentification 3D Secure requise pour: ${paymentIntent.id}`,
        );
        return {
          success: false,
          error: 'Authentification 3D Secure requise',
          status: DepositCaptureStatus.FAILED,
        };
      } else {
        this.logger.error(`Capture échouée. Status: ${paymentIntent.status}`);
        return {
          success: false,
          error: `Capture échouée. Status: ${paymentIntent.status}`,
          status: DepositCaptureStatus.FAILED,
        };
      }
    } catch (error) {
      this.logger.error(
        `Erreur lors de la capture de caution: ${error.message}`,
      );

      // Analyser le type d'erreur Stripe
      if (error.type === 'StripeCardError') {
        return {
          success: false,
          error: `Erreur de carte: ${error.message}`,
          status: DepositCaptureStatus.FAILED,
        };
      } else if (error.code === 'authentication_required') {
        return {
          success: false,
          error: 'Authentification requise',
          status: DepositCaptureStatus.FAILED,
        };
      } else {
        return {
          success: false,
          error: `Erreur technique: ${error.message}`,
          status: DepositCaptureStatus.FAILED,
        };
      }
    }
  }

  /**
   * Annuler/rembourser une caution
   */
  async refundDeposit(
    paymentIntentId: string,
    amount: number,
    reason?: string,
  ): Promise<{
    success: boolean;
    refundId?: string;
    error?: string;
  }> {
    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amount, // Montant en centimes
        reason: 'requested_by_customer',
        metadata: {
          refund_reason: reason || 'Remboursement de caution',
        },
      });

      this.logger.log(
        `Remboursement créé: ${refund.id} pour PaymentIntent: ${paymentIntentId}`,
      );
      return {
        success: refund.status === 'succeeded',
        refundId: refund.id,
      };
    } catch (error) {
      this.logger.error(`Erreur lors du remboursement: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Vérifier la validité d'une méthode de paiement
   */
  async validatePaymentMethod(paymentMethodId: string): Promise<boolean> {
    try {
      const paymentMethod =
        await this.stripe.paymentMethods.retrieve(paymentMethodId);
      return paymentMethod && paymentMethod.type === 'card';
    } catch (error) {
      this.logger.error(
        `Erreur lors de la validation de la méthode de paiement: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Obtenir les détails d'une méthode de paiement
   */
  async getPaymentMethodDetails(paymentMethodId: string): Promise<any> {
    try {
      const paymentMethod =
        await this.stripe.paymentMethods.retrieve(paymentMethodId);
      return {
        id: paymentMethod.id,
        type: paymentMethod.type,
        card: paymentMethod.card
          ? {
              brand: paymentMethod.card.brand,
              last4: paymentMethod.card.last4,
              exp_month: paymentMethod.card.exp_month,
              exp_year: paymentMethod.card.exp_year,
            }
          : null,
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération des détails: ${error.message}`,
      );
      return null;
    }
  }
}
