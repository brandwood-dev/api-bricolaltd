import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Transaction } from './transaction.entity';
import { PaymentMethod } from '../enums/payment-method.enum';
import { PaymentProvider } from './payment-provider.entity';

@Entity({ name: 'payment_transactions' })
export class PaymentTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'transaction_id', type: 'varchar', length: 100 })
  transactionId: string;

  @ManyToOne(() => Transaction)
  @JoinColumn({ name: 'transaction_id' })
  transaction: Transaction;

  @Column({ name: 'payment_method', type: 'varchar', length: 30 })
  paymentMethod: PaymentMethod;

  @Column({ name: 'provider_id' })
  providerId: number;

  @ManyToOne(() => PaymentProvider)
  @JoinColumn({ name: 'provider_id' })
  provider: PaymentProvider;

  @Column({ name: 'amount', type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ name: 'currency', type: 'varchar', length: 3, default: 'EUR' })
  currency: string;

  @Column({ name: 'status', type: 'varchar', length: 30 })
  status: string;

  @Column({
    name: 'provider_transaction_id',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  providerTransactionId: string | null;

  @Column({
    name: 'provider_status',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  providerStatus: string | null;

  @Column({ name: 'error_code', type: 'varchar', length: 30, nullable: true })
  errorCode: string | null;

  @Column({ name: 'error_message', type: 'longtext', nullable: true })
  errorMessage: string | null;

  @Column({ name: 'metadata', type: 'longtext', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'processed_at', type: 'timestamp', nullable: true })
  processedAt: Date | null;
}
