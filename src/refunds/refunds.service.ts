import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';

import { Refund, RefundStatus, RefundReason } from './entities/refund.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { TransactionType } from '../transactions/enums/transaction-type.enum';
import { TransactionStatus } from '../transactions/enums/transaction-status.enum';
import { BookingStatus } from '../bookings/enums/booking-status.enum';

import {
  CreateRefundDto,
  ProcessRefundDto,
  UpdateRefundStatusDto,
} from './dto/refund.dto';
import { WalletsService } from '../wallets/wallets.service';
import { WiseService } from '../wallets/wise-enhanced.service';
import { AdminNotificationsService } from '../admin/admin-notifications.service';
import {
  NotificationCategory as AdminNotificationCategory,
  NotificationPriority as AdminNotificationPriority,
  NotificationType as AdminNotificationType,
} from '../admin/dto/admin-notifications.dto';

export interface RefundResult {
  success: boolean;
  refund?: Refund;
  message: string;
  refundId?: string;
  stripeRefundId?: string;
  amountRefunded?: number;
  error?: string;
}

@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);
  private stripe: Stripe;

  constructor(
    @InjectRepository(Refund)
    private refundRepository: Repository<Refund>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
    private dataSource: DataSource,
    private configService: ConfigService,
    private walletsService: WalletsService,
    private wiseService: WiseService,
    private adminNotificationsService: AdminNotificationsService,
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
   * Create a refund request (initial step)
   */
  async createRefundRequest(
    createRefundDto: CreateRefundDto,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<RefundResult> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      this.logger.log(
        `Creating refund request for transaction ${createRefundDto.transactionId}`,
        {
          userId,
          amount: createRefundDto.amount,
          reason: createRefundDto.reason,
          ipAddress,
        },
      );

      // Get the original transaction
      const originalTransaction = await queryRunner.manager.findOne(
        Transaction,
        {
          where: { id: createRefundDto.transactionId },
          relations: ['booking', 'wallet'],
        },
      );

      if (!originalTransaction) {
        throw new NotFoundException('Original transaction not found');
      }

      // Validate transaction can be refunded
      this.validateTransactionForRefund(
        originalTransaction,
        createRefundDto.amount,
      );

      // Determine refund amount
      const refundAmount = createRefundDto.amount || originalTransaction.amount;

      // Check for existing pending refunds
      const existingPendingRefund = await queryRunner.manager.findOne(Refund, {
        where: {
          transactionId: createRefundDto.transactionId,
          status: In([RefundStatus.PENDING, RefundStatus.PROCESSING]),
        },
      });

      if (existingPendingRefund) {
        throw new BadRequestException(
          'A refund is already pending for this transaction',
        );
      }

      // Create refund record
      const refund = queryRunner.manager.create(Refund, {
        refundId: `ref_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        transactionId: createRefundDto.transactionId,
        bookingId: originalTransaction.bookingId,
        originalAmount: originalTransaction.amount,
        refundAmount: refundAmount,
        currency: 'gbp', // Default to GBP for now
        status: RefundStatus.PENDING,
        reason: createRefundDto.reason,
        reasonDetails: createRefundDto.reasonDetails,
        adminNotes: createRefundDto.adminNotes,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        walletBalanceUpdated: false,
        notificationSent: false,
      });

      const savedRefund = await queryRunner.manager.save(Refund, refund);

      // Create admin notification
      await this.adminNotificationsService.createAdminNotification({
        title: 'New Refund Request',
        message: `Refund request created for transaction ${createRefundDto.transactionId}. Amount: £${refundAmount.toFixed(2)}. Reason: ${createRefundDto.reason}`,
        type: AdminNotificationType.INFO,
        priority: AdminNotificationPriority.MEDIUM,
        category: AdminNotificationCategory.PAYMENT,
      });

      await queryRunner.commitTransaction();

      this.logger.log(`Refund request created successfully: ${savedRefund.id}`);

      return {
        success: true,
        refund: savedRefund,
        message: 'Refund request created successfully',
        refundId: savedRefund.id,
        amountRefunded: refundAmount,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to create refund request for transaction ${createRefundDto.transactionId}:`,
        error,
      );

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to create refund request');
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Process a refund via Wise for international transfers
   */
  async processRefundViaWise(
    refundId: string,
    adminUserId: string,
    targetCurrency: string = 'EUR',
    bankDetails?: {
      iban: string;
      bic: string;
      accountHolderName: string;
    },
  ): Promise<any> {
    try {
      this.logger.log(`Processing refund via Wise: ${refundId}`, {
        adminUserId,
        targetCurrency,
      });

      // Get refund record
      const refund = await this.refundRepository.findOne({
        where: { id: refundId },
        relations: ['transaction', 'transaction.booking'],
      });

      if (!refund) {
        throw new NotFoundException('Refund not found');
      }

      if (refund.status !== RefundStatus.PENDING) {
        throw new BadRequestException(
          `Refund is already ${refund.status.toLowerCase()}`,
        );
      }

      // Get original transaction
      const originalTransaction = refund.transaction;
      if (!originalTransaction) {
        throw new BadRequestException(
          'Original transaction not found for refund',
        );
      }

      // Create quote for currency conversion
      const quote = await this.wiseService.createQuote({
        sourceCurrency: 'GBP',
        targetCurrency: targetCurrency,
        sourceAmount: refund.refundAmount,
        profile: parseInt(
          this.configService.get<string>('WISE_PROFILE_ID') || '0',
        ),
        payOut: 'BANK_TRANSFER',
      });

      // Create recipient account if bank details provided
      let recipientAccount;
      if (bankDetails) {
        recipientAccount = await this.wiseService.createRecipientAccount({
          currency: targetCurrency,
          type: 'iban',
          profile: parseInt(
            this.configService.get<string>('WISE_PROFILE_ID') || '0',
          ),
          accountHolderName: bankDetails.accountHolderName,
          details: {
            iban: bankDetails.iban,
            bic: bankDetails.bic,
          },
        });
      }

      // Create transfer
      const transfer = await this.wiseService.createTransfer({
        targetAccount: recipientAccount?.id || '0', // Use existing recipient if available
        quoteUuid: quote.id,
        customerTransactionId: `refund_${refund.id}_${Date.now()}`,
        reference: `Refund ${refund.id} - ${refund.reason}`,
        transferPurpose: 'verification.transfers.purpose.pay.bills',
        sourceOfFunds: 'verification.source.of.funds.other',
      });

      // Fund the transfer
      const payment = await this.wiseService.fundTransfer(transfer.id, {
        type: 'BALANCE',
      });

      // Update refund with Wise transfer information
      refund.stripeRefundData = transfer.id; // Store Wise transfer ID
      refund.metadata = {
        ...refund.metadata,
        wiseTransferId: transfer.id,
        wiseQuoteId: quote.id,
        wiseRecipientId: recipientAccount?.id,
        wiseTransfer: transfer,
        wisePayment: payment,
        currency: targetCurrency,
      };

      refund.status = RefundStatus.PROCESSING;
      refund.processedAt = new Date();
      refund.processedBy = adminUserId;

      await this.refundRepository.save(refund);

      this.logger.log(`Refund processed via Wise successfully: ${refund.id}`, {
        transferId: transfer.id,
        quoteId: quote.id,
        amount: refund.refundAmount,
        targetCurrency,
      });

      return {
        success: true,
        refund,
        transfer,
        payment,
        quote,
        recipient: recipientAccount,
      };
    } catch (error) {
      this.logger.error(
        `Failed to process refund via Wise: ${refundId}`,
        error,
      );
      throw new InternalServerErrorException(
        `Wise refund processing failed: ${error.message}`,
      );
    }
  }

  /**
   * Process refund via Stripe
   */
  async processRefund(
    refundId: string,
    adminUserId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<RefundResult> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get refund record
      const refund = await queryRunner.manager.findOne(Refund, {
        where: { id: refundId },
        relations: ['transaction', 'transaction.booking'],
      });

      if (!refund) {
        throw new NotFoundException('Refund not found');
      }

      if (refund.status !== RefundStatus.PENDING) {
        throw new BadRequestException(
          `Refund is already ${refund.status.toLowerCase()}`,
        );
      }

      // Get original transaction
      const originalTransaction = await queryRunner.manager.findOne(
        Transaction,
        {
          where: { id: refund.transactionId },
          relations: ['booking', 'wallet'],
        },
      );

      if (!originalTransaction) {
        throw new NotFoundException('Original transaction not found');
      }

      if (!originalTransaction.externalReference) {
        throw new BadRequestException(
          'Original transaction has no external reference (Stripe Payment Intent ID)',
        );
      }

      // Update refund status to processing
      refund.status = RefundStatus.PROCESSING;
      refund.processedBy = adminUserId;
      refund.processedAt = new Date();
      refund.ipAddress = ipAddress || refund.ipAddress;
      refund.userAgent = userAgent || refund.userAgent;

      await queryRunner.manager.save(Refund, refund);

      // Create Stripe refund
      let stripeRefund: Stripe.Refund;
      try {
        stripeRefund = await this.stripe.refunds.create({
          payment_intent: originalTransaction.externalReference,
          amount: Math.round(refund.refundAmount * 100), // Convert to cents
          reason: 'requested_by_customer',
          metadata: {
            refundId: refund.id,
            transactionId: refund.transactionId,
            bookingId: refund.bookingId || '',
            originalAmount: refund.originalAmount.toString(),
            refundReason: refund.reason,
            processedBy: adminUserId,
          },
        });

        this.logger.log(
          `Stripe refund created successfully: ${stripeRefund.id}`,
        );
      } catch (stripeError) {
        this.logger.error(
          `Stripe refund failed for refund ${refundId}:`,
          stripeError,
        );

        // Update refund status to failed
        refund.status = RefundStatus.FAILED;
        refund.failureReason = stripeError.message;
        refund.stripeRefundData = stripeError;
        await queryRunner.manager.save(Refund, refund);

        await queryRunner.commitTransaction();

        return {
          success: false,
          refund,
          message: 'Stripe refund failed',
          error: stripeError.message,
        };
      }

      // Update refund with Stripe data
      refund.refundId = stripeRefund.id;
      refund.status = RefundStatus.COMPLETED;
      refund.stripeRefundData = stripeRefund;
      await queryRunner.manager.save(Refund, refund);

      // Create refund transaction
      const refundTransaction = new Transaction();
      refundTransaction.type = TransactionType.REFUND;
      refundTransaction.amount = -Math.abs(refund.refundAmount); // Negative amount for refund
      refundTransaction.status = TransactionStatus.COMPLETED;
      refundTransaction.description = `Refund for transaction ${refund.transactionId}: ${refund.reason}`;
      refundTransaction.senderId = originalTransaction.recipientId; // Money goes back to original sender
      refundTransaction.recipientId = originalTransaction.senderId;
      refundTransaction.bookingId = refund.bookingId || undefined;
      refundTransaction.walletId = originalTransaction.walletId;
      refundTransaction.externalReference = stripeRefund.id;
      refundTransaction.providerMetadata = {
        originalTransactionId: refund.transactionId,
        refundId: refund.id,
        refundReason: refund.reason,
        refundReasonDetails: refund.reasonDetails,
        processedBy: adminUserId,
      };

      await queryRunner.manager.save(Transaction, refundTransaction);

      // Update wallet balance
      if (originalTransaction.walletId) {
        await this.walletsService.deductFunds(
          originalTransaction.walletId,
          refund.refundAmount,
        );
        refund.walletBalanceUpdated = true;
        await queryRunner.manager.save(Refund, refund);
      }

      // Update booking status if applicable
      if (refund.bookingId) {
        const booking = await queryRunner.manager.findOne(Booking, {
          where: { id: refund.bookingId },
        });

        if (booking) {
          booking.refundAmount = refund.refundAmount;
          booking.refundReason = refund.reasonDetails || refund.reason;
          await queryRunner.manager.save(Booking, booking);
        }
      }

      // Create admin notification
      await this.adminNotificationsService.createAdminNotification({
        title: 'Refund Processed Successfully',
        message: `Refund ${refund.id} processed successfully. Amount: £${refund.refundAmount.toFixed(2)}. Stripe Refund ID: ${stripeRefund.id}`,
        type: AdminNotificationType.SUCCESS,
        priority: AdminNotificationPriority.MEDIUM,
        category: AdminNotificationCategory.PAYMENT,
      });

      await queryRunner.commitTransaction();

      this.logger.log(`Refund processed successfully: ${refund.id}`);

      return {
        success: true,
        refund,
        message: 'Refund processed successfully',
        refundId: refund.id,
        stripeRefundId: stripeRefund.id,
        amountRefunded: refund.refundAmount,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to process refund ${refundId}:`, error);

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to process refund');
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get refund by ID
   */
  async getRefundById(refundId: string): Promise<Refund> {
    const refund = await this.refundRepository.findOne({
      where: { id: refundId },
      relations: ['transaction', 'booking'],
    });

    if (!refund) {
      throw new NotFoundException('Refund not found');
    }

    return refund;
  }

  /**
   * Get refunds by transaction ID
   */
  async getRefundsByTransactionId(transactionId: string): Promise<Refund[]> {
    return this.refundRepository.find({
      where: { transactionId },
      relations: ['transaction', 'booking'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get refunds by booking ID
   */
  async getRefundsByBookingId(bookingId: string): Promise<Refund[]> {
    return this.refundRepository.find({
      where: { bookingId },
      relations: ['transaction', 'booking'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get refunds by user ID (through transaction)
   */
  async getRefundsByUserId(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    refunds: Refund[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;

    // Get transactions for this user
    const transactions = await this.transactionRepository.find({
      where: [{ senderId: userId }, { recipientId: userId }],
      select: ['id'],
    });

    const transactionIds = transactions.map((t) => t.id);

    if (transactionIds.length === 0) {
      return {
        refunds: [],
        total: 0,
        page,
        totalPages: 0,
      };
    }

    const [refunds, total] = await this.refundRepository.findAndCount({
      where: { transactionId: In(transactionIds) },
      relations: ['transaction', 'booking'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      refunds,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get all refunds with pagination and filters
   */
  async getAllRefunds(
    page: number = 1,
    limit: number = 20,
    filters?: {
      status?: RefundStatus;
      reason?: RefundReason;
      transactionId?: string;
      bookingId?: string;
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<{
    refunds: Refund[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.reason) {
      where.reason = filters.reason;
    }

    if (filters?.transactionId) {
      where.transactionId = filters.transactionId;
    }

    if (filters?.bookingId) {
      where.bookingId = filters.bookingId;
    }

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.$gte = filters.startDate;
      }
      if (filters.endDate) {
        where.createdAt.$lte = filters.endDate;
      }
    }

    const [refunds, total] = await this.refundRepository.findAndCount({
      where,
      relations: ['transaction', 'booking'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      refunds,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Update refund status
   */
  async updateRefundStatus(
    refundId: string,
    updateDto: UpdateRefundStatusDto,
    adminUserId: string,
  ): Promise<Refund> {
    const refund = await this.getRefundById(refundId);

    const oldStatus = refund.status;
    refund.status = updateDto.status;
    refund.adminNotes = updateDto.adminNotes || refund.adminNotes;

    await this.refundRepository.save(refund);

    this.logger.log(
      `Refund ${refundId} status updated from ${oldStatus} to ${updateDto.status} by admin ${adminUserId}`,
    );

    // Create admin notification
    await this.adminNotificationsService.createAdminNotification({
      title: 'Refund Status Updated',
      message: `Refund ${refund.id} status updated from ${oldStatus} to ${updateDto.status}. ${updateDto.statusReason || ''}`,
      type: AdminNotificationType.INFO,
      priority: AdminNotificationPriority.MEDIUM,
      category: AdminNotificationCategory.PAYMENT,
    });

    return refund;
  }

  /**
   * Get refund statistics
   */
  async getRefundStats(): Promise<{
    totalRefunds: number;
    totalRefundAmount: number;
    averageRefundAmount: number;
    refundsByStatus: Record<string, number>;
    refundsByReason: Record<string, number>;
    refundsThisMonth: number;
    amountThisMonth: number;
  }> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalRefunds,
      totalRefundAmount,
      refundsByStatus,
      refundsByReason,
      refundsThisMonth,
      amountThisMonth,
    ] = await Promise.all([
      this.refundRepository.count(),
      this.refundRepository
        .createQueryBuilder('refund')
        .select('SUM(refund.refund_amount)', 'total')
        .where('refund.status = :status', { status: RefundStatus.COMPLETED })
        .getRawOne(),
      this.refundRepository
        .createQueryBuilder('refund')
        .select('refund.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('refund.status')
        .getRawMany(),
      this.refundRepository
        .createQueryBuilder('refund')
        .select('refund.reason', 'reason')
        .addSelect('COUNT(*)', 'count')
        .groupBy('refund.reason')
        .getRawMany(),
      this.refundRepository
        .createQueryBuilder('refund')
        .where('refund.createdAt >= :startDate', { startDate: startOfMonth })
        .getCount(),
      this.refundRepository
        .createQueryBuilder('refund')
        .select('SUM(refund.refund_amount)', 'total')
        .where('refund.createdAt >= :startDate', { startDate: startOfMonth })
        .andWhere('refund.status = :status', { status: RefundStatus.COMPLETED })
        .getRawOne(),
    ]);

    const refundsByStatusMap: Record<string, number> = {};
    refundsByStatus.forEach((item) => {
      refundsByStatusMap[item.status] = parseInt(item.count);
    });

    const refundsByReasonMap: Record<string, number> = {};
    refundsByReason.forEach((item) => {
      refundsByReasonMap[item.reason] = parseInt(item.count);
    });

    const avgRefundAmount =
      totalRefunds > 0 ? (totalRefundAmount?.total || 0) / totalRefunds : 0;

    return {
      totalRefunds,
      totalRefundAmount: totalRefundAmount?.total || 0,
      averageRefundAmount: avgRefundAmount,
      refundsByStatus: refundsByStatusMap,
      refundsByReason: refundsByReasonMap,
      refundsThisMonth,
      amountThisMonth: amountThisMonth?.total || 0,
    };
  }

  /**
   * Validate transaction for refund
   */
  private validateTransactionForRefund(
    transaction: Transaction,
    requestedAmount?: number,
  ): void {
    // Check if transaction is completed
    if (transaction.status !== TransactionStatus.COMPLETED) {
      throw new BadRequestException(
        'Only completed transactions can be refunded',
      );
    }

    // Check if transaction type supports refunds
    const refundableTypes = [
      TransactionType.PAYMENT,
      TransactionType.DEPOSIT,
      TransactionType.WITHDRAWAL,
    ];
    if (!refundableTypes.includes(transaction.type)) {
      throw new BadRequestException(
        `Transaction type ${transaction.type} is not refundable`,
      );
    }

    // Validate requested amount
    if (requestedAmount) {
      if (requestedAmount <= 0) {
        throw new BadRequestException('Refund amount must be positive');
      }

      if (requestedAmount > transaction.amount) {
        throw new BadRequestException(
          'Refund amount cannot exceed original transaction amount',
        );
      }

      // Convert to pounds for comparison
      const maxRefundable = transaction.amount;
      if (requestedAmount > maxRefundable) {
        throw new BadRequestException(
          `Maximum refundable amount is £${maxRefundable.toFixed(2)}`,
        );
      }
    }

    // Check if external reference exists (Stripe Payment Intent ID)
    if (!transaction.externalReference) {
      throw new BadRequestException(
        'Transaction has no external payment reference',
      );
    }
  }
}
