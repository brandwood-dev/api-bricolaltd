import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from '../transactions/entities/transaction.entity';
import { TransactionStatus } from '../transactions/enums/transaction-status.enum';
import { TransactionType } from '../transactions/enums/transaction-type.enum';
import { ConfigService } from '@nestjs/config';
import { WiseService } from './wise.service';

@Injectable()
export class WithdrawalProcessingService {
  private readonly logger = new Logger(WithdrawalProcessingService.name);
  private stripe: any;

  constructor(
    @InjectRepository(Transaction)
    private transactionsRepository: Repository<Transaction>,
    private configService: ConfigService,
    private wiseService: WiseService,
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
    bankAccountDetails?: any,
    method?: 'wise' | 'stripe_connect' | 'stripe_payout'
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
      let providerResult: any;
      const useMethod: 'wise' | 'stripe_connect' | 'stripe_payout' = method
        || (bankAccountDetails ? 'wise' : (stripeAccountId ? 'stripe_connect' : 'stripe_payout'));

      if (useMethod === 'stripe_connect' && stripeAccountId) {
        providerResult = await this.createStripeConnectTransfer(
          transaction.amount,
          stripeAccountId,
          transaction.id
        );
      } else if (useMethod === 'stripe_payout' && bankAccountDetails) {
        providerResult = await this.createStripePayout(
          transaction.amount,
          bankAccountDetails,
          transaction.id
        );
      } else if (useMethod === 'wise' && bankAccountDetails) {
        if (!this.validateBankDetails(bankAccountDetails)) {
          throw new BadRequestException('Détails bancaires invalides (IBAN/BIC)');
        }
        const quote = await this.wiseService.createQuote({
          sourceCurrency: 'GBP',
          targetCurrency: bankAccountDetails.currency,
          sourceAmount: Number(transaction.amount),
          profile: this.configService.get('WISE_PROFILE_ID') || '',
          payOut: 'BALANCE',
        });

        const recipientAccount = await this.wiseService.createRecipientAccount({
          currency: bankAccountDetails.currency,
          type: bankAccountDetails.iban ? 'iban' : 'bank_account',
          profile: this.configService.get('WISE_PROFILE_ID') || '',
          accountHolderName: bankAccountDetails.accountHolderName,
          details: {
            iban: bankAccountDetails.iban,
            bic: bankAccountDetails.bic,
            accountNumber: bankAccountDetails.accountNumber,
            routingNumber: bankAccountDetails.routingNumber,
          },
        });

        const transfer = await this.wiseService.createAndFundTransfer({
          targetAccount: recipientAccount.id,
          quoteUuid: quote.id,
          customerTransactionId: transaction.id,
          details: {
            reference: `Retrait Bricola - ${transaction.id}`,
            transferPurpose: 'verification.transfers.purpose.pay.bills',
            sourceOfFunds: 'verification.source.of.funds.other',
          },
        });
        providerResult = transfer;

        transaction.externalReference = String(transfer.id);
        (transaction as any).wizeTransferId = String(transfer.id);
        (transaction as any).wizeStatus = transfer.status;
      } else {
        throw new BadRequestException('Aucune méthode de paiement spécifiée');
      }

      transaction.status = TransactionStatus.COMPLETED;
      transaction.processedAt = new Date();
      if (providerResult?.id && !transaction.externalReference) {
        transaction.externalReference = providerResult.id;
      }

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

  private validateBankDetails(details: any): boolean {
    const iban = details?.iban;
    const bic = details?.bic;
    const accountNumber = details?.accountNumber;
    const routingNumber = details?.routingNumber;

    if (iban) {
      if (!this.isValidIban(iban)) return false;
    }
    if (bic) {
      if (!this.isValidBic(bic)) return false;
    }
    // Basic checks for non-IBAN accounts
    if (!iban && (accountNumber || routingNumber)) {
      if (!accountNumber || accountNumber.length < 6) return false;
    }
    return true;
  }

  private isValidIban(iban: string): boolean {
    const trimmed = iban.replace(/\s+/g, '').toUpperCase();
    const ibanRegex = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/;
    if (!ibanRegex.test(trimmed)) return false;
    const rearranged = trimmed.slice(4) + trimmed.slice(0, 4);
    const numeric = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
    let remainder = 0;
    for (let i = 0; i < numeric.length; i += 7) {
      const block = String(remainder) + numeric.substr(i, 7);
      remainder = Number(block) % 97;
    }
    return remainder === 1;
  }

  private isValidBic(bic: string): boolean {
    const trimmed = bic.replace(/\s+/g, '').toUpperCase();
    const bicRegex = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/;
    return bicRegex.test(trimmed);
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