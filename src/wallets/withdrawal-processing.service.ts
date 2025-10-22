import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from '../transactions/entities/transaction.entity';
import { TransactionStatus } from '../transactions/enums/transaction-status.enum';
import { TransactionType } from '../transactions/enums/transaction-type.enum';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WithdrawalProcessingService {
  private readonly logger = new Logger(WithdrawalProcessingService.name);
  private stripe: any;

  constructor(
    @InjectRepository(Transaction)
    private transactionsRepository: Repository<Transaction>,
    private configService: ConfigService,
  ) {
    // Initialiser Stripe avec la clé secrète
    const Stripe = require('stripe');
    this.stripe = new Stripe(this.configService.get('STRIPE_SECRET_KEY'));
  }

  /**
   * Traite une demande de retrait en appelant l'API Stripe
   * @param transactionId ID de la transaction de retrait
   * @param stripeAccountId ID du compte Stripe Connect de l'utilisateur (optionnel)
   * @param bankAccountDetails Détails du compte bancaire pour les virements (optionnel)
   */
  async processWithdrawal(
    transactionId: string,
    stripeAccountId?: string,
    bankAccountDetails?: any
  ): Promise<Transaction> {
    const transaction = await this.transactionsRepository.findOne({
      where: { id: transactionId },
      relations: ['sender']
    });

    if (!transaction) {
      throw new BadRequestException('Transaction de retrait introuvable');
    }

    if (transaction.type !== TransactionType.WITHDRAWAL) {
      throw new BadRequestException('Cette transaction n\'est pas un retrait');
    }

    if (transaction.status !== TransactionStatus.PENDING) {
      throw new BadRequestException('Cette transaction a déjà été traitée');
    }

    try {
      let stripeTransfer;

      if (stripeAccountId) {
        // Utiliser Stripe Connect pour transférer vers le compte connecté
        stripeTransfer = await this.createStripeConnectTransfer(
          transaction.amount,
          stripeAccountId,
          transaction.id
        );
      } else if (bankAccountDetails) {
        // Utiliser Stripe Payouts pour virement bancaire
        stripeTransfer = await this.createStripePayout(
          transaction.amount,
          bankAccountDetails,
          transaction.id
        );
      } else {
        throw new BadRequestException('Aucune méthode de paiement spécifiée');
      }

      // Mettre à jour la transaction avec le succès
      transaction.status = TransactionStatus.COMPLETED;
      transaction.processedAt = new Date();
      transaction.externalReference = stripeTransfer.id;

      this.logger.log(`Retrait traité avec succès: ${transaction.id}`);
      
      return await this.transactionsRepository.save(transaction);

    } catch (error) {
      this.logger.error(`Erreur lors du traitement du retrait ${transaction.id}:`, error);
      
      // Marquer la transaction comme échouée
      transaction.status = TransactionStatus.FAILED;
      transaction.description = `${transaction.description} - Erreur: ${error.message}`;
      
      await this.transactionsRepository.save(transaction);
      throw new BadRequestException(`Échec du retrait: ${error.message}`);
    }
  }

  /**
   * Crée un transfert Stripe Connect
   */
  private async createStripeConnectTransfer(
    amount: number,
    stripeAccountId: string,
    transactionId: string
  ) {
    // TODO: Implémenter l'appel à l'API Stripe Connect
    // Exemple de code (à décommenter et adapter) :
    /*
    return await this.stripe.transfers.create({
      amount: Math.round(amount * 100), // Stripe utilise les centimes
      currency: 'eur',
      destination: stripeAccountId,
      metadata: {
        transaction_id: transactionId,
        type: 'withdrawal'
      }
    });
    */
    
    // Simulation pour le développement
    this.logger.log(`Simulation: Transfert Stripe Connect de ${amount}€ vers ${stripeAccountId}`);
    return { id: `tr_simulated_${Date.now()}` };
  }

  /**
   * Crée un virement bancaire via Stripe Payouts
   */
  private async createStripePayout(
    amount: number,
    bankAccountDetails: any,
    transactionId: string
  ) {
    // TODO: Implémenter l'appel à l'API Stripe Payouts
    // Exemple de code (à décommenter et adapter) :
    /*
    return await this.stripe.payouts.create({
      amount: Math.round(amount * 100), // Stripe utilise les centimes
      currency: 'eur',
      method: 'instant',
      metadata: {
        transaction_id: transactionId,
        type: 'withdrawal'
      }
    });
    */
    
    // Simulation pour le développement
    this.logger.log(`Simulation: Virement bancaire de ${amount}€ vers ${JSON.stringify(bankAccountDetails)}`);
    return { id: `po_simulated_${Date.now()}` };
  }

  /**
   * Récupère toutes les demandes de retrait en attente
   */
  async getPendingWithdrawals(): Promise<Transaction[]> {
    return this.transactionsRepository.find({
      where: {
        type: TransactionType.WITHDRAWAL,
        status: TransactionStatus.PENDING
      },
      relations: ['sender'],
      order: { createdAt: 'ASC' }
    });
  }

  /**
   * Annule une demande de retrait
   */
  async cancelWithdrawal(transactionId: string, reason: string): Promise<Transaction> {
    const transaction = await this.transactionsRepository.findOne({
      where: { id: transactionId }
    });

    if (!transaction) {
      throw new BadRequestException('Transaction introuvable');
    }

    if (transaction.status !== TransactionStatus.PENDING) {
      throw new BadRequestException('Seules les transactions en attente peuvent être annulées');
    }

    transaction.status = TransactionStatus.CANCELLED;
    transaction.description = `${transaction.description} - Annulé: ${reason}`;
    
    return this.transactionsRepository.save(transaction);
  }
}