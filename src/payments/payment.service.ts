import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { TransactionStatus } from '../transactions/enums/transaction-status.enum';
import { TransactionType } from '../transactions/enums/transaction-type.enum';
import { PaymentMethod } from '../transactions/enums/payment-method.enum';
import { ThreeDSecureService } from './three-d-secure/three-d-secure.service';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private stripe: any;

  constructor(
    @InjectRepository(Transaction)
    private transactionsRepository: Repository<Transaction>,
    @InjectRepository(Wallet)
    private walletsRepository: Repository<Wallet>,
    private configService: ConfigService,
    private threeDSecureService: ThreeDSecureService,
  ) {
    // Initialiser Stripe avec la clé secrète
    const Stripe = require('stripe');
    this.stripe = new Stripe(this.configService.get('STRIPE_SECRET_KEY'));
  }

  /**
   * Crée un Payment Intent avec support 3D Secure
   */
  async createPaymentIntentWith3DS(options: {
    amount: number;
    currency?: string;
    bookingId?: string;
    metadata?: any;
    userId?: string;
    billingDetails?: {
      name: string;
      email: string;
      phone?: string;
      address?: {
        line1: string;
        line2?: string;
        city: string;
        state?: string;
        postalCode: string;
        country: string;
      };
    };
    deviceInfo?: {
      screenResolution?: string;
      timezone?: string;
      language?: string;
      colorDepth?: number;
      javaEnabled?: boolean;
      javascriptEnabled?: boolean;
      acceptHeaders?: string;
      userAgent?: string;
    };
  }): Promise<any> {
    try {
      const { 
        amount, 
        currency = 'gbp', 
        bookingId, 
        metadata = {}, 
        userId,
        billingDetails,
        deviceInfo
      } = options;

      // Validate amount and currency
      this.validatePaymentAmount(amount);
      this.validateCurrency(currency);

      // Check if 3D Secure is required
      const requires3DS = await this.threeDSecureService.is3DSecureRequired(
        amount,
        currency,
        billingDetails?.address?.country,
        billingDetails?.address?.country
      );

      this.logger.log(`Creating payment intent with 3DS support`, {
        amount,
        currency,
        requires3DS,
        userId,
        bookingId,
      });

      // Prepare payment intent data
      const paymentIntentData: any = {
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toLowerCase(),
        capture_method: 'automatic',
        metadata: {
          ...metadata,
          user_id: userId,
          booking_id: bookingId,
          created_at: new Date().toISOString(),
          frontend_amount: amount,
          requires_3ds: requires3DS,
        },
      };

      // Add 3D Secure configuration if required
      if (requires3DS) {
        paymentIntentData.payment_method_options = {
          card: {
            request_three_d_secure: 'any',
          },
        };
      }

      // Add billing details if provided
      if (billingDetails) {
        paymentIntentData.receipt_email = billingDetails.email;
      }

      const paymentIntent = await this.stripe.paymentIntents.create(paymentIntentData);

      this.logger.log(`Payment intent created with 3DS support`, {
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        requires3DS,
      });

      // Initialize 3D Secure if required
      if (requires3DS && userId) {
        // Store that this payment intent may require 3DS
        // The actual 3DS flow will be triggered during confirmation
        this.logger.log(`3D Secure may be required for payment intent: ${paymentIntent.id}`);
      }

      return {
        ...paymentIntent,
        requires_3ds: requires3DS,
      };

    } catch (error) {
      this.logger.error('Error creating payment intent with 3DS:', error);
      throw new BadRequestException(`Failed to create payment intent: ${error.message}`);
    }
  }

  /**
   * Crée un Payment Intent pour bloquer les fonds (Legacy method)
   */
  async createPaymentIntent(options: {
    amount: number;
    currency?: string;
    bookingId?: string;
    metadata?: any;
  }): Promise<any> {
    const { amount, currency = 'gbp', metadata = {} } = options;
    try {
      // 🔍 LOGS ULTRA-DÉTAILLÉS POUR DÉBOGUER LE PROBLÈME DE CONVERSION
      this.logger.log(`🔍 [PaymentService] === DÉBUT ANALYSE BACKEND ===`);
      this.logger.log(`🔍 [PaymentService] Montant reçu depuis frontend: ${amount}`);
      this.logger.log(`🔍 [PaymentService] Type du montant: ${typeof amount}`);
      this.logger.log(`🔍 [PaymentService] Devise: ${currency}`);
      
      // CORRECTION: Le montant reçu du frontend est déjà en centimes
      // Exemple: pour £0.93, le frontend envoie 93 (centimes)
      // Donc on utilise directement ce montant sans conversion
      const amountInCents = Math.round(amount);
      
      this.logger.log(`🔍 [PaymentService] Montant final envoyé à Stripe (centimes): ${amountInCents}`);
      this.logger.log(`🔍 [PaymentService] Équivalent en devise principale: £${amountInCents / 100}`);
      
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: amountInCents, // Le montant est déjà en centimes depuis PaymentForm.tsx
        currency: currency.toLowerCase(),
        capture_method: 'automatic', // Capture automatique après autorisation
        metadata: {
          ...metadata,
          created_at: new Date().toISOString(),
          frontend_amount: amount,
          final_amount_cents: amountInCents,
        },
      });

      this.logger.log(`🔍 [PaymentService] Payment Intent créé avec succès:`);
      this.logger.log(`🔍 [PaymentService] - ID: ${paymentIntent.id}`);
      this.logger.log(`🔍 [PaymentService] - Montant Stripe: ${paymentIntent.amount} centimes`);
      this.logger.log(`🔍 [PaymentService] - Équivalent: £${paymentIntent.amount / 100}`);
      this.logger.log(`🔍 [PaymentService] - Devise: ${paymentIntent.currency}`);
      this.logger.log(`🔍 [PaymentService] === FIN ANALYSE BACKEND ===`);
      
      return paymentIntent;
    } catch (error) {
      this.logger.error('🔍 [PaymentService] Erreur lors de la création du Payment Intent:', error);
      throw new BadRequestException(`Erreur de paiement: ${error.message}`);
    }
  }

  /**
   * Confirme un Payment Intent avec les détails de paiement
   */
  async confirmPaymentIntent(
    paymentIntentId: string,
    paymentMethodId: string
  ): Promise<any> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.confirm(paymentIntentId, {
        payment_method: paymentMethodId,
      });

      this.logger.log(`Payment Intent confirmé: ${paymentIntentId}`);
      return paymentIntent;
    } catch (error) {
      this.logger.error(`Erreur lors de la confirmation du Payment Intent ${paymentIntentId}:`, error);
      throw new BadRequestException(`Erreur de confirmation: ${error.message}`);
    }
  }

  /**
   * Capture les fonds d'un Payment Intent (finalise le paiement)
   */
  async capturePaymentIntent(
    paymentIntentId: string,
    amountToCapture?: number
  ): Promise<any> {
    try {
      const captureData: any = {};
      
      if (amountToCapture) {
        captureData.amount_to_capture = Math.round(amountToCapture * 100);
      }

      const paymentIntent = await this.stripe.paymentIntents.capture(
        paymentIntentId,
        captureData
      );

      this.logger.log(`Fonds capturés pour Payment Intent: ${paymentIntentId}`);
      return paymentIntent;
    } catch (error) {
      this.logger.error(`Erreur lors de la capture des fonds ${paymentIntentId}:`, error);
      throw new BadRequestException(`Erreur de capture: ${error.message}`);
    }
  }

  /**
   * Annule un Payment Intent (libère les fonds bloqués)
   */
  async cancelPaymentIntent(paymentIntentId: string): Promise<any> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.cancel(paymentIntentId);
      
      this.logger.log(`Payment Intent annulé: ${paymentIntentId}`);
      return paymentIntent;
    } catch (error) {
      this.logger.error(`Erreur lors de l'annulation du Payment Intent ${paymentIntentId}:`, error);
      throw new BadRequestException(`Erreur d'annulation: ${error.message}`);
    }
  }

  /**
   * Crée un remboursement pour un paiement capturé
   */
  async createRefund(
    paymentIntentId: string,
    amount?: number,
    reason?: string
  ): Promise<any> {
    try {
      const refundData: any = {
        payment_intent: paymentIntentId,
      };

      if (amount) {
        refundData.amount = Math.round(amount * 100);
      }

      if (reason) {
        refundData.reason = reason;
      }

      const refund = await this.stripe.refunds.create(refundData);
      
      this.logger.log(`Remboursement créé: ${refund.id} pour Payment Intent: ${paymentIntentId}`);
      return refund;
    } catch (error) {
      this.logger.error(`Erreur lors du remboursement ${paymentIntentId}:`, error);
      throw new BadRequestException(`Erreur de remboursement: ${error.message}`);
    }
  }

  /**
   * Récupère les détails d'un Payment Intent
   */
  async getPaymentIntent(paymentIntentId: string): Promise<any> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      return paymentIntent;
    } catch (error) {
      this.logger.error(`Erreur lors de la récupération du Payment Intent ${paymentIntentId}:`, error);
      throw new NotFoundException(`Payment Intent introuvable: ${paymentIntentId}`);
    }
  }

  /**
   * Crée une transaction dans la base de données liée à un Payment Intent
   */
  async createTransactionForPaymentIntent(
    paymentIntentId: string,
    userId: string,
    walletId: string,
    amount: number,
    type: TransactionType,
    description: string,
    bookingId?: string
  ): Promise<Transaction> {
    try {
      const transaction = this.transactionsRepository.create({
        amount,
        type,
        status: TransactionStatus.PENDING,
        description,
        externalReference: paymentIntentId,
        paymentMethod: PaymentMethod.CARD,
        senderId: userId,
        walletId,
        bookingId,
        createdAt: new Date(),
      });

      const savedTransaction = await this.transactionsRepository.save(transaction);
      this.logger.log(`Transaction créée: ${savedTransaction.id} pour Payment Intent: ${paymentIntentId}`);
      
      return savedTransaction;
    } catch (error) {
      this.logger.error('Erreur lors de la création de la transaction:', error);
      throw new BadRequestException(`Erreur de création de transaction: ${error.message}`);
    }
  }

  /**
   * Met à jour le statut d'une transaction basée sur un Payment Intent
   */
  async updateTransactionStatus(
    paymentIntentId: string,
    status: TransactionStatus,
    processedAt?: Date
  ): Promise<Transaction> {
    try {
      const transaction = await this.transactionsRepository.findOne({
        where: { externalReference: paymentIntentId }
      });

      if (!transaction) {
        throw new NotFoundException(`Transaction introuvable pour Payment Intent: ${paymentIntentId}`);
      }

      transaction.status = status;
      if (processedAt) {
        transaction.processedAt = processedAt;
      }

      const updatedTransaction = await this.transactionsRepository.save(transaction);
      this.logger.log(`Transaction ${transaction.id} mise à jour: ${status}`);
      
      return updatedTransaction;
    } catch (error) {
      this.logger.error(`Erreur lors de la mise à jour de la transaction pour ${paymentIntentId}:`, error);
      throw error;
    }
  }

  /**
   * Traite le blocage des fonds pour une réservation
   */
  async holdFundsForBooking(
    userId: string,
    amount: number,
    bookingId: string,
    currency: string = 'gbp'
  ): Promise<{ paymentIntent: any; transaction: Transaction }> {
    try {
      // Récupérer le portefeuille de l'utilisateur
      const wallet = await this.walletsRepository.findOne({
        where: { userId }
      });

      if (!wallet) {
        throw new NotFoundException('Portefeuille utilisateur introuvable');
      }

      // Créer le Payment Intent pour bloquer les fonds
      const paymentIntent = await this.createPaymentIntent({
        amount,
        currency,
        metadata: {
          booking_id: bookingId,
          user_id: userId,
          type: 'booking_hold'
        }
      });

      // Créer la transaction correspondante
      const transaction = await this.createTransactionForPaymentIntent(
        paymentIntent.id,
        userId,
        wallet.id,
        amount,
        TransactionType.PAYMENT,
        `Blocage des fonds pour la réservation ${bookingId}`,
        bookingId
      );

      return { paymentIntent, transaction };
    } catch (error) {
      this.logger.error(`Erreur lors du blocage des fonds pour la réservation ${bookingId}:`, error);
      throw error;
    }
  }

  /**
   * Capture les fonds pour finaliser une réservation
   */
  async captureFundsForBooking(
    paymentIntentId: string,
    amountToCapture?: number
  ): Promise<{ paymentIntent: any; transaction: Transaction }> {
    try {
      // Capturer les fonds
      const paymentIntent = await this.capturePaymentIntent(paymentIntentId, amountToCapture);

      // Mettre à jour la transaction
      const transaction = await this.updateTransactionStatus(
        paymentIntentId,
        TransactionStatus.COMPLETED,
        new Date()
      );

      return { paymentIntent, transaction };
    } catch (error) {
      this.logger.error(`Erreur lors de la capture des fonds pour ${paymentIntentId}:`, error);
      throw error;
    }
  }

  /**
   * Libère les fonds bloqués (annulation de réservation)
   */
  async releaseFundsForBooking(
    paymentIntentId: string
  ): Promise<{ paymentIntent: any; transaction: Transaction }> {
    try {
      // Annuler le Payment Intent
      const paymentIntent = await this.cancelPaymentIntent(paymentIntentId);

      // Mettre à jour la transaction
      const transaction = await this.updateTransactionStatus(
        paymentIntentId,
        TransactionStatus.CANCELLED,
        new Date()
      );

      return { paymentIntent, transaction };
    } catch (error) {
      this.logger.error(`Erreur lors de la libération des fonds pour ${paymentIntentId}:`, error);
      throw error;
    }
  }

  /**
   * Validate payment amount
   */
  private validatePaymentAmount(amount: number): void {
    if (isNaN(amount) || amount <= 0) {
      throw new BadRequestException('Invalid payment amount');
    }
    
    if (amount > 10000) { // Maximum £10,000
      throw new BadRequestException('Payment amount exceeds maximum limit of £10,000');
    }
    
    if (amount < 0.50) { // Minimum £0.50
      throw new BadRequestException('Payment amount below minimum threshold of £0.50');
    }
  }

  /**
   * Validate currency
   */
  private validateCurrency(currency: string): void {
    const supportedCurrencies = ['gbp', 'eur', 'usd'];
    
    if (!supportedCurrencies.includes(currency.toLowerCase())) {
      throw new BadRequestException(`Currency ${currency} is not supported`);
    }
  }
}