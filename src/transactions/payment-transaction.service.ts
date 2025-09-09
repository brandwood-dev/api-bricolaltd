import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentTransaction } from './entities/payment-transaction.entity';
import { CreatePaymentTransactionDto } from './dto/create-payment-transaction.dto';
import { UpdatePaymentTransactionDto } from './dto/update-payment-transaction.dto';
import { TransactionsService } from './transactions.service';
import { PaymentProviderService } from './payment-provider.service';

@Injectable()
export class PaymentTransactionService {
  constructor(
    @InjectRepository(PaymentTransaction)
    private paymentTransactionRepository: Repository<PaymentTransaction>,
    private transactionsService: TransactionsService,
    private paymentProviderService: PaymentProviderService,
  ) {}

  async create(createPaymentTransactionDto: CreatePaymentTransactionDto): Promise<PaymentTransaction> {
    // Validate that the transaction exists
    await this.transactionsService.findOne(createPaymentTransactionDto.transactionId);

    // Validate that the payment provider exists
    await this.paymentProviderService.findOne(createPaymentTransactionDto.providerId);

    const paymentTransaction = this.paymentTransactionRepository.create(createPaymentTransactionDto);
    return this.paymentTransactionRepository.save(paymentTransaction);
  }

  async findAll(): Promise<PaymentTransaction[]> {
    return this.paymentTransactionRepository.find({
      relations: ['transaction', 'provider'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<PaymentTransaction> {
    const paymentTransaction = await this.paymentTransactionRepository.findOne({
      where: { id },
      relations: ['transaction', 'provider'],
    });

    if (!paymentTransaction) {
      throw new NotFoundException(`Payment transaction with ID ${id} not found`);
    }

    return paymentTransaction;
  }

  async findByTransactionId(transactionId: string): Promise<PaymentTransaction[]> {
    return this.paymentTransactionRepository.find({
      where: { transactionId },
      relations: ['transaction', 'provider'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByProviderId(providerId: number): Promise<PaymentTransaction[]> {
    return this.paymentTransactionRepository.find({
      where: { providerId },
      relations: ['transaction', 'provider'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByStatus(status: string): Promise<PaymentTransaction[]> {
    return this.paymentTransactionRepository.find({
      where: { status },
      relations: ['transaction', 'provider'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByProviderTransactionId(providerTransactionId: string): Promise<PaymentTransaction> {
    const paymentTransaction = await this.paymentTransactionRepository.findOne({
      where: { providerTransactionId },
      relations: ['transaction', 'provider'],
    });

    if (!paymentTransaction) {
      throw new NotFoundException(`Payment transaction with provider ID ${providerTransactionId} not found`);
    }

    return paymentTransaction;
  }

  async update(id: string, updatePaymentTransactionDto: UpdatePaymentTransactionDto): Promise<PaymentTransaction> {
    const paymentTransaction = await this.findOne(id);

    // Validate transaction ID if being updated
    if (updatePaymentTransactionDto.transactionId && updatePaymentTransactionDto.transactionId !== paymentTransaction.transactionId) {
      await this.transactionsService.findOne(updatePaymentTransactionDto.transactionId);
    }

    // Validate provider ID if being updated
    if (updatePaymentTransactionDto.providerId && updatePaymentTransactionDto.providerId !== paymentTransaction.providerId) {
      await this.paymentProviderService.findOne(updatePaymentTransactionDto.providerId);
    }

    Object.assign(paymentTransaction, updatePaymentTransactionDto);
    return this.paymentTransactionRepository.save(paymentTransaction);
  }

  async updateStatus(id: string, status: string, providerStatus?: string, errorCode?: string, errorMessage?: string): Promise<PaymentTransaction> {
    const paymentTransaction = await this.findOne(id);
    
    paymentTransaction.status = status;
    if (providerStatus) paymentTransaction.providerStatus = providerStatus;
    if (errorCode) paymentTransaction.errorCode = errorCode;
    if (errorMessage) paymentTransaction.errorMessage = errorMessage;
    
    // Set processedAt if status is completed or failed
    if (status === 'completed' || status === 'failed') {
      paymentTransaction.processedAt = new Date();
    }

    return this.paymentTransactionRepository.save(paymentTransaction);
  }

  async remove(id: string): Promise<void> {
    const paymentTransaction = await this.findOne(id);
    await this.paymentTransactionRepository.remove(paymentTransaction);
  }
}