import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from '../transactions/entities/transaction.entity';
import { PaymentTransaction } from '../transactions/entities/payment-transaction.entity';
import { TransactionFilterParams } from '../transactions/dto/transaction-filter.dto';
import { TransactionStatus } from '../transactions/enums/transaction-status.enum';
import { TransactionType } from '../transactions/enums/transaction-type.enum';

@Injectable()
export class AdminTransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(PaymentTransaction)
    private paymentTransactionRepository: Repository<PaymentTransaction>,
  ) {}

  async getTransactions(filters: TransactionFilterParams) {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      type,
      startDate,
      endDate,
    } = filters;

    const queryBuilder = this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.sender', 'sender')
      .leftJoinAndSelect('transaction.recipient', 'recipient')
      .leftJoinAndSelect('transaction.wallet', 'wallet')
      .orderBy('transaction.createdAt', 'DESC');

    if (search) {
      queryBuilder.andWhere(
        '(transaction.id LIKE :search OR sender.email LIKE :search OR sender.firstName LIKE :search OR sender.lastName LIKE :search OR recipient.email LIKE :search OR recipient.firstName LIKE :search OR recipient.lastName LIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (status) {
      queryBuilder.andWhere('transaction.status = :status', { status });
    }

    if (type) {
      queryBuilder.andWhere('transaction.type = :type', { type });
    }

    if (startDate) {
      queryBuilder.andWhere('transaction.createdAt >= :startDate', {
        startDate,
      });
    }

    if (endDate) {
      queryBuilder.andWhere('transaction.createdAt <= :endDate', {
        endDate,
      });
    }

    const [data, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getTransactionStats(startDate?: string, endDate?: string) {
    const queryBuilder = this.transactionRepository.createQueryBuilder('transaction');

    if (startDate) {
      queryBuilder.andWhere('transaction.createdAt >= :startDate', { startDate });
    }

    if (endDate) {
      queryBuilder.andWhere('transaction.createdAt <= :endDate', { endDate });
    }

    // Get total transactions count
    const totalTransactions = await queryBuilder.getCount();

    // Get successful transactions
    const successfulTransactions = await queryBuilder
      .clone()
      .andWhere('transaction.status = :status', { status: TransactionStatus.COMPLETED })
      .getCount();

    // Get failed transactions
    const failedTransactions = await queryBuilder
      .clone()
      .andWhere('transaction.status = :status', { status: TransactionStatus.FAILED })
      .getCount();

    // Get pending transactions
    const pendingTransactions = await queryBuilder
      .clone()
      .andWhere('transaction.status = :status', { status: TransactionStatus.PENDING })
      .getCount();

    // Get disputed transactions (using cancelled as proxy for disputed)
    const disputedTransactions = await queryBuilder
      .clone()
      .andWhere('transaction.status = :status', { status: TransactionStatus.CANCELLED })
      .getCount();

    // Calculate total revenue from completed transactions
    const revenueResult = await queryBuilder
      .clone()
      .select('SUM(transaction.amount)', 'totalRevenue')
      .andWhere('transaction.status IN (:...statuses)', { statuses: [TransactionStatus.COMPLETED] })
      .andWhere('transaction.type IN (:...types)', {
        types: [TransactionType.PAYMENT, TransactionType.DEPOSIT],
      })
      .getRawOne();

    const totalRevenue = parseFloat(revenueResult?.totalRevenue || '0');

    // Calculate average transaction value
    const averageTransactionValue = successfulTransactions > 0 ? totalRevenue / successfulTransactions : 0;

    // Calculate revenue growth (simplified - comparing with previous period)
    const previousPeriodStart = startDate
      ? new Date(new Date(startDate).getTime() - (new Date(endDate || new Date()).getTime() - new Date(startDate).getTime()))
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    
    const previousPeriodEnd = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const previousRevenueResult = await this.transactionRepository
      .createQueryBuilder('transaction')
      .select('SUM(transaction.amount)', 'previousRevenue')
      .andWhere('transaction.status IN (:...statuses)', { statuses: [TransactionStatus.COMPLETED] })
      .andWhere('transaction.type IN (:...types)', {
        types: [TransactionType.PAYMENT, TransactionType.DEPOSIT],
      })
      .andWhere('transaction.createdAt >= :start', { start: previousPeriodStart })
      .andWhere('transaction.createdAt <= :end', { end: previousPeriodEnd })
      .getRawOne();

    const previousRevenue = parseFloat(previousRevenueResult?.previousRevenue || '0');
    const revenueGrowth = previousRevenue > 0 ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 : 0;

    return {
      totalRevenue,
      totalTransactions,
      successfulTransactions,
      failedTransactions,
      pendingTransactions,
      disputedTransactions,
      averageTransactionValue,
      revenueGrowth,
    };
  }

  async getTransactionsByType() {
    const result = await this.transactionRepository
      .createQueryBuilder('transaction')
      .select('transaction.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(transaction.amount)', 'amount')
      .groupBy('transaction.type')
      .getRawMany();

    return result.map(item => ({
      type: item.type,
      count: parseInt(item.count),
      amount: parseFloat(item.amount || '0'),
    }));
  }

  async getTransactionsByStatus() {
    const result = await this.transactionRepository
      .createQueryBuilder('transaction')
      .select('transaction.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(transaction.amount)', 'amount')
      .groupBy('transaction.status')
      .getRawMany();

    return result.map(item => ({
      status: item.status,
      count: parseInt(item.count),
      amount: parseFloat(item.amount || '0'),
    }));
  }

  async getDisputedTransactions(filters: TransactionFilterParams) {
    const modifiedFilters = { ...filters, status: TransactionStatus.CANCELLED };
    return this.getTransactions(modifiedFilters);
  }

  async getFailedTransactions(filters: TransactionFilterParams) {
    const modifiedFilters = { ...filters, status: TransactionStatus.FAILED };
    return this.getTransactions(modifiedFilters);
  }

  async getTransactionById(id: string) {
    const transaction = await this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.sender', 'sender')
      .leftJoinAndSelect('transaction.recipient', 'recipient')
      .leftJoinAndSelect('transaction.wallet', 'wallet')
      .where('transaction.id = :id', { id })
      .getOne();

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return transaction;
  }

  async updateTransactionStatus(id: string, status: TransactionStatus, reason?: string) {
    const transaction = await this.getTransactionById(id);
    
    transaction.status = status;
    if (reason) {
      // Add reason to transaction metadata or description if available
      transaction.description = reason;
    }

    return this.transactionRepository.save(transaction);
  }

  async processRefund(refundData: { transactionId: string; amount: number; reason: string; notifyUser?: boolean }) {
    const transaction = await this.getTransactionById(refundData.transactionId);
    
    // Create a refund transaction
    const refundTransaction = this.transactionRepository.create({
      type: TransactionType.REFUND,
      amount: refundData.amount,
      status: TransactionStatus.COMPLETED,
      description: `Refund for transaction ${refundData.transactionId}: ${refundData.reason}`,
      walletId: transaction.walletId,
    });

    return this.transactionRepository.save(refundTransaction);
  }

  async performBulkAction(bulkData: { transactionIds: string[]; action: string; reason?: string }) {
    const transactions = await this.transactionRepository
      .createQueryBuilder('transaction')
      .where('transaction.id IN (:...ids)', { ids: bulkData.transactionIds })
      .getMany();

    if (transactions.length === 0) {
      throw new NotFoundException('No transactions found');
    }

    // Perform bulk action based on action type
    switch (bulkData.action) {
      case 'approve':
        transactions.forEach(t => t.status = TransactionStatus.COMPLETED);
        break;
      case 'reject':
        transactions.forEach(t => t.status = TransactionStatus.FAILED);
        break;
      case 'cancel':
        transactions.forEach(t => t.status = TransactionStatus.CANCELLED);
        break;
      case 'refund':
        transactions.forEach(t => t.status = TransactionStatus.REFUNDED);
        break;
      default:
        throw new Error('Invalid bulk action');
    }

    if (bulkData.reason) {
      transactions.forEach(t => t.description = bulkData.reason);
    }

    return this.transactionRepository.save(transactions);
  }

  async retryFailedTransaction(id: string) {
    const transaction = await this.getTransactionById(id);
    
    if (transaction.status !== TransactionStatus.FAILED) {
      throw new Error('Only failed transactions can be retried');
    }

    transaction.status = TransactionStatus.PENDING;
    return this.transactionRepository.save(transaction);
  }
}