/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from './entities/transaction.entity';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { WalletsService } from '../wallets/wallets.service';
import { TransactionType } from './enums/transaction-type.enum';
import { TransactionStatus } from './enums/transaction-status.enum';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private transactionsRepository: Repository<Transaction>,
    private walletsService: WalletsService,
  ) {}

  async create(
    createTransactionDto: CreateTransactionDto,
  ): Promise<Transaction> {
    // Validate transaction type
    const validTypes = Object.values(TransactionType);
    if (
      !validTypes.includes(
        createTransactionDto.type as unknown as TransactionType,
      )
    ) {
      throw new BadRequestException('Invalid transaction type');
    }

    // Process transaction based on type
    switch (createTransactionDto.type) {
      case TransactionType.DEPOSIT:
        await this.walletsService.addFunds(
          createTransactionDto.walletId,
          createTransactionDto.amount,
        );
        break;
      case TransactionType.WITHDRAWAL:
      case TransactionType.PAYMENT:
        await this.walletsService.deductFunds(
          createTransactionDto.walletId,
          createTransactionDto.amount,
        );
        break;
      case TransactionType.REFUND:
        await this.walletsService.addFunds(
          createTransactionDto.walletId,
          createTransactionDto.amount,
        );
        break;
      case 'TRANSFER':
        if (!createTransactionDto.recipientWalletId) {
          throw new BadRequestException(
            'Recipient wallet ID is required for transfers',
          );
        }
        await this.walletsService.deductFunds(
          createTransactionDto.walletId,
          createTransactionDto.amount,
        );
        await this.walletsService.addFunds(
          createTransactionDto.recipientWalletId,
          createTransactionDto.amount,
        );
        break;
    }

    // Create and save the transaction record
    const transaction = this.transactionsRepository.create({
      ...createTransactionDto,
      type: createTransactionDto.type as unknown as TransactionType,
      status: TransactionStatus.COMPLETED,
      createdAt: new Date(),
    });

    return this.transactionsRepository.save(transaction);
  }

  async findAll(): Promise<Transaction[]> {
    return this.transactionsRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Transaction> {
    const transaction = await this.transactionsRepository.findOne({
      where: { id },
    });
    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }
    return transaction;
  }

  async findByWalletId(walletId: string): Promise<Transaction[]> {
    return this.transactionsRepository.find({
      where: { walletId },
      order: { createdAt: 'DESC' },
    });
  }

  async update(
    id: string,
    updateTransactionDto: UpdateTransactionDto,
  ): Promise<Transaction> {
    // Only allow updating certain fields like description or reference
    const transaction = await this.findOne(id);

    // Don't allow changing critical fields like amount, type, or status after creation
    if (
      updateTransactionDto.amount !== undefined ||
      updateTransactionDto.type !== undefined ||
      updateTransactionDto.status !== undefined
    ) {
      throw new BadRequestException(
        'Cannot update amount, type, or status of an existing transaction',
      );
    }

    Object.assign(transaction, updateTransactionDto);
    return this.transactionsRepository.save(transaction);
  }

  async remove(id: string): Promise<void> {
    // In financial systems, it's usually better to void or cancel transactions rather than delete them
    // This is a simplified implementation for demonstration purposes
    const transaction = await this.findOne(id);
    transaction.status = TransactionStatus.CANCELLED;
    await this.transactionsRepository.save(transaction);
  }
}
