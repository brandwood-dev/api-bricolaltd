import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from '../transactions/entities/transaction.entity';
import { TransactionStatus } from '../transactions/enums/transaction-status.enum';
import { TransactionType } from '../transactions/enums/transaction-type.enum';
import { ConfigService } from '@nestjs/config';
import { WiseService } from './wise-enhanced.service';
import { AdminNotificationsService } from '../admin/admin-notifications.service';
import {
  NotificationCategory as AdminNotificationCategory,
  NotificationPriority as AdminNotificationPriority,
  NotificationType as AdminNotificationType,
} from '../admin/dto/admin-notifications.dto';
import Stripe from 'stripe';

@Injectable()
export class WithdrawalProcessingService {
  private readonly logger = new Logger(WithdrawalProcessingService.name);
  private stripe: Stripe;

  constructor(
    @InjectRepository(Transaction)
    private transactionsRepository: Repository<Transaction>,
    private configService: ConfigService,
    private wiseService: WiseService,
    private adminNotificationsService: AdminNotificationsService,
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
    method?: 'wise' | 'stripe_connect' | 'stripe_payout',
  ): Promise<Transaction> {
    const transaction = await this.transactionsRepository.findOne({
      where: { id: transactionId },
      relations: ['sender'],
    });

    if (!transaction) {
      throw new BadRequestException('Transaction de retrait introuvable');
    }

    if (transaction.type !== TransactionType.WITHDRAWAL) {
      throw new BadRequestException("Cette transaction n'est pas un retrait");
    }

    if (transaction.status !== TransactionStatus.PENDING) {
      throw new BadRequestException('Cette transaction a déjà été traitée');
    }

    try {
      let providerResult: any;
      const useMethod: 'wise' | 'stripe_connect' | 'stripe_payout' =
        method ||
        (bankAccountDetails
          ? 'wise'
          : stripeAccountId
            ? 'stripe_connect'
            : 'stripe_payout');

      if (useMethod === 'stripe_connect' && stripeAccountId) {
        // Try Wise first using connected account bank details
        try {
          const account = await this.stripe.accounts.retrieve(stripeAccountId);
          const externalAccounts =
            await this.stripe.accounts.listExternalAccounts(stripeAccountId, {
              object: 'bank_account',
            });
          const bankAccount = (externalAccounts?.data || []).find(
            (ba: any) => ba.object === 'bank_account',
          );
          if (bankAccount) {
            const bank = bankAccount as Stripe.BankAccount;
            const targetCurrency = bank.currency
              ? bank.currency.toUpperCase()
              : this.deriveCurrencyFromCountry(bank.country || undefined);
            const accountHolderName =
              (account as any)?.business_profile?.name ||
              (account as any)?.individual?.first_name +
                ' ' +
                (account as any)?.individual?.last_name ||
              'Account Holder';
            const ibanCandidate: string | undefined = (bank as any)?.iban;
            if (ibanCandidate) {
              const quote = await this.wiseService.createQuote({
                sourceCurrency: 'GBP',
                targetCurrency,
                sourceAmount: Number(transaction.amount),
                profile: this.getWiseProfileId(),
                payOut: 'BALANCE',
              });

              const recipient = await this.wiseService.createRecipientAccount({
                currency: targetCurrency,
                type: 'iban',
                profile: this.getWiseProfileId(),
                accountHolderName,
                details: {
                  iban: ibanCandidate,
                },
              });

              const transfer = await this.wiseService.createAndFundTransfer({
                targetAccount: recipient.id,
                quoteUuid: quote.id,
                customerTransactionId: transaction.id,
                reference: `Withdrawal to Stripe ${stripeAccountId}`,
                transferPurpose: 'verification.transfers.purpose.pay.bills',
                sourceOfFunds: 'verification.source.of.funds.other',
              });

              providerResult = transfer;
              transaction.externalReference = String(
                transfer.transfer?.id || transfer.id,
              );
              (transaction as any).wizeTransferId = String(
                transfer.transfer?.id || transfer.id,
              );
              (transaction as any).wizeStatus =
                transfer.transfer?.status || transfer.status;
            } else {
              providerResult = await this.createStripeConnectTransfer(
                transaction.amount,
                stripeAccountId,
                transaction.id,
              );
              if (providerResult?.id) {
                transaction.externalReference = providerResult.id;
                (transaction as any).stripeTransferId = providerResult.id;
                (transaction as any).stripeTransferStatus =
                  providerResult.status;
              }
            }
          } else {
            // Fallback to Stripe Connect transfer if no bank account info
            providerResult = await this.createStripeConnectTransfer(
              transaction.amount,
              stripeAccountId,
              transaction.id,
            );
            if (providerResult?.id) {
              transaction.externalReference = providerResult.id;
              (transaction as any).stripeTransferId = providerResult.id;
              (transaction as any).stripeTransferStatus = providerResult.status;
            }
          }
        } catch (err) {
          // Fallback to Stripe Connect transfer on error
          providerResult = await this.createStripeConnectTransfer(
            transaction.amount,
            stripeAccountId,
            transaction.id,
          );
          if (providerResult?.id) {
            transaction.externalReference = providerResult.id;
            (transaction as any).stripeTransferId = providerResult.id;
            (transaction as any).stripeTransferStatus = providerResult.status;
          }
        }
      } else if (useMethod === 'stripe_payout' && bankAccountDetails) {
        providerResult = await this.createStripePayout(
          transaction.amount,
          bankAccountDetails,
          transaction.id,
        );
        // Update transaction with real payout data
        if (providerResult?.id) {
          transaction.externalReference = providerResult.id;
          (transaction as any).stripePayoutId = providerResult.id;
          (transaction as any).stripePayoutStatus = providerResult.status;
        }
      } else if (useMethod === 'wise' && bankAccountDetails) {
        if (!this.validateBankDetails(bankAccountDetails)) {
          throw new BadRequestException(
            'Détails bancaires invalides (IBAN/BIC)',
          );
        }
        const currency =
          bankAccountDetails.currency ||
          this.detectCurrencyFromIban(bankAccountDetails.iban);
        const profileId = this.getWiseProfileId();
        const autoFundEnabled = this.configService.get<boolean>(
          'WISE_AUTO_FUND',
          true,
        );

        this.logger.log(`Creating quote with profile: ${profileId}`);
        const quote = await this.wiseService.createQuote({
          sourceCurrency: 'GBP',
          targetCurrency: currency,
          sourceAmount: Number(transaction.amount),
          profile: profileId,
          payOut: 'BALANCE',
        });
        this.logger.log('Wise quote created', {
          transactionId: transaction.id,
          quoteId: quote.id,
        });

        const recipientAccount = await this.wiseService.createRecipientAccount({
          currency,
          type: bankAccountDetails.iban ? 'iban' : 'bank_account',
          profile: this.getWiseProfileId(),
          accountHolderName: bankAccountDetails.accountHolderName,
          details: {
            iban: bankAccountDetails.iban,
            bic: bankAccountDetails.bic,
            accountNumber: bankAccountDetails.accountNumber,
            routingNumber: bankAccountDetails.routingNumber,
          },
        });
        this.logger.log('Wise recipient created', {
          transactionId: transaction.id,
          recipientId: recipientAccount.id,
        });

        let transfer: any;
        let payment: any;

        if (autoFundEnabled) {
          // Try auto-funding first
          this.logger.log(
            `Attempting auto-funding for transfer with quote ID: ${quote.id}, profile: ${profileId}`,
          );
          try {
            const result = await this.wiseService.createAndFundTransfer({
              targetAccount: recipientAccount.id,
              quoteUuid: quote.id,
              customerTransactionId: transaction.id,
              reference: `Retrait Bricola - ${transaction.id}`,
              transferPurpose: 'verification.transfers.purpose.pay.bills',
              sourceOfFunds: 'verification.source.of.funds.other',
            });
            transfer = result.transfer;
            payment = result.payment;
            this.logger.log('Wise transfer auto-funded successfully', {
              transactionId: transaction.id,
              transferId: transfer.id,
              paymentId: payment?.id,
            });
          } catch (error) {
            this.logger.warn(
              `Auto-funding failed, creating transfer for manual funding: ${error.message}`,
              {
                transactionId: transaction.id,
                error: error.message,
              },
            );

            // Create transfer without funding for manual processing
            transfer = await this.wiseService.createTransfer({
              targetAccount: recipientAccount.id,
              quoteUuid: quote.id,
              customerTransactionId: transaction.id,
              reference: `Retrait Bricola - ${transaction.id} (Manual Funding Required)`,
              transferPurpose: 'verification.transfers.purpose.pay.bills',
              sourceOfFunds: 'verification.source.of.funds.other',
            });

            // Create admin notification for manual funding required
            await this.adminNotificationsService.createAdminNotification({
              title: 'Manual Funding Required for Wise Transfer',
              message: `Transfer ${transfer.id} for withdrawal ${transaction.id} (£${Number(transaction.amount).toFixed(2)}) requires manual funding. Error: ${error.message}`,
              type: AdminNotificationType.WARNING,
              priority: AdminNotificationPriority.HIGH,
              category: AdminNotificationCategory.PAYMENT,
            });

            this.logger.log('Wise transfer created for manual funding', {
              transactionId: transaction.id,
              transferId: transfer.id,
              requiresManualFunding: true,
            });
          }
        } else {
          // Manual funding mode - create transfer without funding
          this.logger.log(
            `Creating transfer for manual funding with quote ID: ${quote.id}, profile: ${profileId}`,
          );
          transfer = await this.wiseService.createTransfer({
            targetAccount: recipientAccount.id,
            quoteUuid: quote.id,
            customerTransactionId: transaction.id,
            reference: `Retrait Bricola - ${transaction.id} (Manual Funding Required)`,
            transferPurpose: 'verification.transfers.purpose.pay.bills',
            sourceOfFunds: 'verification.source.of.funds.other',
          });

          // Create admin notification for manual funding required
          await this.adminNotificationsService.createAdminNotification({
            title: 'Manual Funding Required for Wise Transfer',
            message: `Transfer ${transfer.id} for withdrawal ${transaction.id} (£${Number(transaction.amount).toFixed(2)}) requires manual funding. Auto-funding is disabled.`,
            type: AdminNotificationType.INFO,
            priority: AdminNotificationPriority.MEDIUM,
            category: AdminNotificationCategory.PAYMENT,
          });

          this.logger.log(
            'Wise transfer created for manual funding (auto-funding disabled)',
            {
              transactionId: transaction.id,
              transferId: transfer.id,
            },
          );
        }

        providerResult = transfer;
        transaction.externalReference = String(transfer.id);

        // Debug log before assignment
        this.logger.log('Assigning Wise transfer data to transaction', {
          transferId: transfer.id,
          transferStatus: transfer.status,
          autoFundEnabled: autoFundEnabled,
          paymentExists: !!payment,
        });

        (transaction as any).wizeTransferId = String(transfer.id);
        (transaction as any).wizeStatus = transfer.status;
        (transaction as any).requiresManualFunding =
          !autoFundEnabled || !payment;

        // Debug log after assignment
        this.logger.log('Wise transfer data assigned to transaction', {
          wizeTransferId: (transaction as any).wizeTransferId,
          wizeStatus: (transaction as any).wizeStatus,
          requiresManualFunding: (transaction as any).requiresManualFunding,
        });
      } else {
        throw new BadRequestException('Aucune méthode de paiement spécifiée');
      }

      // Set transaction status based on funding method
      const requiresManualFunding = (transaction as any).requiresManualFunding;
      if (requiresManualFunding) {
        transaction.status = TransactionStatus.PENDING;
        this.logger.log(
          `Withdrawal created successfully but requires manual funding: ${transaction.id}`,
        );

        // Create admin notification for manual funding required
        await this.adminNotificationsService.createAdminNotification({
          title: 'Withdrawal Requires Manual Funding',
          message: `Withdrawal ${transaction.id} for £${Number(transaction.amount).toFixed(2)} requires manual funding. Transfer ID: ${(transaction as any).wizeTransferId}`,
          type: AdminNotificationType.WARNING,
          priority: AdminNotificationPriority.HIGH,
          category: AdminNotificationCategory.PAYMENT,
        });
      } else {
        transaction.status = TransactionStatus.COMPLETED;
        transaction.processedAt = new Date();
        this.logger.log(`Retrait traité avec succès: ${transaction.id}`);

        // Create admin notification for successful withdrawal
        await this.adminNotificationsService.createAdminNotification({
          title: 'Withdrawal Processed Successfully',
          message: `Withdrawal ${transaction.id} processed successfully. Amount: £${Number(transaction.amount).toFixed(2)}. Method: ${useMethod}`,
          type: AdminNotificationType.SUCCESS,
          priority: AdminNotificationPriority.MEDIUM,
          category: AdminNotificationCategory.PAYMENT,
        });
      }

      if (providerResult?.id && !transaction.externalReference) {
        transaction.externalReference = providerResult.id;
      }

      // Debug log before saving transaction
      this.logger.log('Saving transaction with Wise data', {
        transactionId: transaction.id,
        externalReference: transaction.externalReference,
        wizeTransferId: (transaction as any).wizeTransferId,
        wizeStatus: (transaction as any).wizeStatus,
        requiresManualFunding: (transaction as any).requiresManualFunding,
        status: transaction.status,
      });

      const savedTransaction =
        await this.transactionsRepository.save(transaction);

      // Debug log after saving transaction
      this.logger.log('Transaction saved successfully', {
        transactionId: savedTransaction.id,
        externalReference: savedTransaction.externalReference,
        wizeTransferId: savedTransaction.wizeTransferId,
        wizeStatus: savedTransaction.wizeStatus,
        status: savedTransaction.status,
      });

      return savedTransaction;
    } catch (error) {
      this.logger.error(`Failed to process withdrawal ${transaction.id}:`, {
        error: error.message,
        transactionId: transaction.id,
        amount: transaction.amount,
        method: method,
        stack: error.stack,
      });

      // Mark transaction as failed with detailed error information
      transaction.status = TransactionStatus.FAILED;
      transaction.description = `${transaction.description} - Transfer failed: ${error.message}`;
      transaction.processedAt = new Date();

      await this.transactionsRepository.save(transaction);

      // Create admin notification for failed withdrawal
      await this.adminNotificationsService.createAdminNotification({
        title: 'Withdrawal Processing Failed',
        message: `Withdrawal ${transaction.id} failed. Amount: £${Number(transaction.amount).toFixed(2)}. Error: ${error.message}`,
        type: AdminNotificationType.ERROR,
        priority: AdminNotificationPriority.HIGH,
        category: AdminNotificationCategory.PAYMENT,
      });

      // Throw sanitized error message for API consumers
      if (error.message.includes('Stripe') || error.message.includes('Wise')) {
        throw new BadRequestException(
          'Transfer processing failed. Please contact support if the issue persists.',
        );
      }
      throw new BadRequestException(`Transfer failed: ${error.message}`);
    }
  }

  private detectCurrencyFromIban(iban?: string): string {
    const cc = (iban || '').trim().slice(0, 2).toUpperCase();
    const map: Record<string, string> = {
      GB: 'GBP',
      FR: 'EUR',
      DE: 'EUR',
      ES: 'EUR',
      IT: 'EUR',
      NL: 'EUR',
      BE: 'EUR',
      PT: 'EUR',
      IE: 'EUR',
      AT: 'EUR',
      AE: 'AED',
      SA: 'SAR',
      QA: 'QAR',
      KW: 'KWD',
      BH: 'BHD',
      OM: 'OMR',
    };
    return map[cc] || 'GBP';
  }

  private deriveCurrencyFromCountry(country?: string): string {
    const cc = (country || '').trim().toUpperCase();
    const map: Record<string, string> = {
      GB: 'GBP',
      FR: 'EUR',
      DE: 'EUR',
      ES: 'EUR',
      IT: 'EUR',
      NL: 'EUR',
      BE: 'EUR',
      PT: 'EUR',
      IE: 'EUR',
      AT: 'EUR',
      AE: 'AED',
      SA: 'SAR',
      QA: 'QAR',
      KW: 'KWD',
      BH: 'BHD',
      OM: 'OMR',
    };
    return map[cc] || 'GBP';
  }

  private getWiseProfileId(): number {
    const raw = this.configService.get<string>('WISE_PROFILE_ID') || '';
    const profileId = parseInt(raw.trim(), 10);
    if (!profileId || Number.isNaN(profileId)) {
      throw new InternalServerErrorException('WISE_PROFILE_ID not configured');
    }
    return profileId;
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
    const numeric = rearranged.replace(/[A-Z]/g, (c) =>
      String(c.charCodeAt(0) - 55),
    );
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
    transactionId: string,
  ): Promise<Stripe.Transfer> {
    try {
      this.logger.log(
        `Creating real Stripe Connect transfer: ${amount}€ to account ${stripeAccountId}`,
      );

      // Validate amount before processing
      this.validateTransferAmount(amount);

      // Create real Stripe Connect transfer
      const transfer = await this.stripe.transfers.create({
        amount: Math.round(amount * 100), // Stripe uses cents
        currency: 'gbp', // Using GBP as per project requirements
        destination: stripeAccountId,
        metadata: {
          transaction_id: transactionId,
          type: 'withdrawal',
          platform: 'bricola',
          timestamp: new Date().toISOString(),
        },
      });

      this.logger.log(
        `Real Stripe Connect transfer created successfully: ${transfer.id}`,
      );
      return transfer;
    } catch (error) {
      this.logger.error(`Failed to create Stripe Connect transfer:`, error);
      throw new BadRequestException(
        `Stripe Connect transfer failed: ${error.message}`,
      );
    }
  }

  /**
   * Crée un virement bancaire via Stripe Payouts
   */
  private async createStripePayout(
    amount: number,
    bankAccountDetails: any,
    transactionId: string,
  ): Promise<Stripe.Payout> {
    try {
      this.logger.log(
        `Creating real Stripe payout: ${amount}€ to bank account`,
      );

      // Validate amount before processing
      this.validateTransferAmount(amount);

      // Create real Stripe payout to external bank account
      const payout = await this.stripe.payouts.create({
        amount: Math.round(amount * 100), // Stripe uses cents
        currency: 'gbp', // Using GBP as per project requirements
        method: 'standard', // Standard bank transfer (1-7 business days)
        metadata: {
          transaction_id: transactionId,
          type: 'withdrawal',
          platform: 'bricola',
          timestamp: new Date().toISOString(),
        },
      });

      this.logger.log(`Real Stripe payout created successfully: ${payout.id}`);
      return payout;
    } catch (error) {
      this.logger.error(`Failed to create Stripe payout:`, error);
      throw new BadRequestException(`Stripe payout failed: ${error.message}`);
    }
  }

  /**
   * Valide le montant du transfert
   */
  private validateTransferAmount(amount: number): void {
    if (isNaN(amount) || amount <= 0) {
      throw new BadRequestException('Invalid transfer amount');
    }

    if (amount > 10000) {
      // Maximum £10,000 per transfer
      throw new BadRequestException(
        'Transfer amount exceeds maximum limit of £10,000',
      );
    }

    if (amount < 0.5) {
      // Minimum £0.50 per transfer
      throw new BadRequestException(
        'Transfer amount below minimum threshold of £0.50',
      );
    }
  }

  /**
   * Récupère toutes les demandes de retrait en attente
   */
  async getPendingWithdrawals(): Promise<Transaction[]> {
    return this.transactionsRepository.find({
      where: {
        type: TransactionType.WITHDRAWAL,
        status: TransactionStatus.PENDING,
      },
      relations: ['sender'],
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Annule une demande de retrait
   */
  async cancelWithdrawal(
    transactionId: string,
    reason: string,
  ): Promise<Transaction> {
    const transaction = await this.transactionsRepository.findOne({
      where: { id: transactionId },
    });

    if (!transaction) {
      throw new BadRequestException('Transaction introuvable');
    }

    if (transaction.status !== TransactionStatus.PENDING) {
      throw new BadRequestException(
        'Seules les transactions en attente peuvent être annulées',
      );
    }

    transaction.status = TransactionStatus.CANCELLED;
    transaction.description = `${transaction.description} - Annulé: ${reason}`;

    const savedTransaction =
      await this.transactionsRepository.save(transaction);

    // Create admin notification for cancelled withdrawal
    await this.adminNotificationsService.createAdminNotification({
      title: 'Withdrawal Cancelled',
      message: `Withdrawal ${transactionId} cancelled. Reason: ${reason}. Amount: £${Number(transaction.amount).toFixed(2)}`,
      type: AdminNotificationType.WARNING,
      priority: AdminNotificationPriority.MEDIUM,
      category: AdminNotificationCategory.PAYMENT,
    });

    return savedTransaction;
  }
}
