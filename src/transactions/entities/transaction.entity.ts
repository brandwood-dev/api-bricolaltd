import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Wallet } from '../../wallets/entities/wallet.entity';
import { User } from '../../users/entities/user.entity';
import { Booking } from '../../bookings/entities/booking.entity';
import { Dispute } from '../../disputes/entities/dispute.entity';
import { TransactionType } from '../enums/transaction-type.enum';
import { TransactionStatus } from '../enums/transaction-status.enum';
import { PaymentMethod } from '../enums/payment-method.enum';

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'The unique identifier of the transaction' })
  id: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  @ApiProperty({ description: 'The amount of the transaction', example: 50.75 })
  amount: number;

  @Column({ name: 'type' })
  @ApiProperty({ description: 'The type of the transaction' })
  type: TransactionType;

  @Column({ name: 'status' })
  @ApiProperty({ description: 'The status of the transaction' })
  status: TransactionStatus;

  @Column({ type: 'text', nullable: true })
  @ApiProperty({
    description: 'The description of the transaction',
    required: false,
  })
  description?: string;

  @Column({ nullable: true, name: 'external_reference' })
  @ApiProperty({
    description: 'The external reference ID for the transaction',
    required: false,
  })
  externalReference?: string;

  @Column({ nullable: true, name: 'payment_provider' })
  @ApiProperty({
    description: 'The payment provider used (e.g., STRIPE, WISE)',
    required: false,
  })
  paymentProvider?: string;

  @Column({ nullable: true, name: 'provider_reference' })
  @ApiProperty({
    description: 'Provider-specific reference ID',
    required: false,
  })
  providerReference?: string;

  @Column({ type: 'json', nullable: true, name: 'provider_metadata' })
  @ApiProperty({
    description: 'Provider-specific metadata (JSON)',
    required: false,
  })
  providerMetadata?: Record<string, any>;

  @Column({ nullable: true, name: 'payment_method' })
  @ApiProperty({
    description: 'The payment method used',
    required: false,
  })
  paymentMethod?: PaymentMethod;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'sender_id' })
  @ApiProperty({
    description: 'The user who sent the payment',
    type: () => User,
  })
  sender: User;

  @Column({ name: 'sender_id' })
  senderId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'recipient_id' })
  @ApiProperty({
    description: 'The user who received the payment',
    type: () => User,
  })
  recipient: User;

  @Column({ name: 'recipient_id' })
  recipientId: string;

  @ManyToOne(() => Wallet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'wallet_id' })
  @ApiProperty({
    description: 'The wallet associated with the transaction',
    type: () => Wallet,
  })
  wallet: Wallet;

  @Column({ name: 'wallet_id' })
  walletId: string;

  @ManyToOne(() => Booking, { nullable: true })
  @JoinColumn({ name: 'booking_id' })
  @ApiProperty({
    description: 'The booking associated with the transaction',
    required: false,
  })
  booking?: Booking;

  @Column({ nullable: true, name: 'booking_id' })
  bookingId?: string;

  @ManyToOne(() => Dispute, { nullable: true })
  @JoinColumn({ name: 'dispute_id' })
  @ApiProperty({
    description: 'The dispute associated with the transaction',
    required: false,
  })
  dispute?: Dispute;

  @Column({ nullable: true, name: 'dispute_id' })
  disputeId?: string;

  @Column({
    nullable: true,
    name: 'fee_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  @ApiProperty({
    description: 'The fee amount for the transaction',
    required: false,
  })
  feeAmount?: number;

  @CreateDateColumn({ name: 'created_at' })
  @ApiProperty({ description: 'The date when the transaction was created' })
  createdAt: Date;

  @Column({ nullable: true, name: 'processed_at' })
  @ApiProperty({
    description: 'The date when the transaction was processed',
    required: false,
  })
  processedAt?: Date;

  @Column({ nullable: true, name: 'wize_transfer_id' })
  @ApiProperty({ description: 'Wise transfer id', required: false })
  wizeTransferId?: string;

  @Column({ nullable: true, name: 'wize_status' })
  @ApiProperty({ description: 'Wise transfer status', required: false })
  wizeStatus?: string;

  @Column({ type: 'json', nullable: true, name: 'wize_response' })
  @ApiProperty({ description: 'Wise API response snapshot', required: false })
  wizeResponse?: Record<string, any>;
}
