import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { Booking } from '../../bookings/entities/booking.entity';

export enum RefundStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum RefundReason {
  CUSTOMER_REQUEST = 'CUSTOMER_REQUEST',
  BOOKING_CANCELLATION = 'BOOKING_CANCELLATION',
  TOOL_UNAVAILABLE = 'TOOL_UNAVAILABLE',
  SERVICE_ISSUE = 'SERVICE_ISSUE',
  FRAUD = 'FRAUD',
  DUPLICATE_PAYMENT = 'DUPLICATE_PAYMENT',
  ADMIN_DECISION = 'ADMIN_DECISION',
  OTHER = 'OTHER',
}

@Entity('refunds')
@Index(['refundId'], { unique: true })
@Index(['transactionId'])
@Index(['bookingId'])
@Index(['status'])
@Index(['createdAt'])
export class Refund {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'refund_id', type: 'varchar', length: 255, unique: true })
  refundId: string; // Stripe refund ID

  @Column({ name: 'transaction_id', type: 'uuid' })
  transactionId: string;

  @ManyToOne(() => Transaction)
  @JoinColumn({ name: 'transaction_id' })
  transaction: Transaction;

  @Column({ name: 'booking_id', type: 'uuid', nullable: true })
  bookingId: string | null;

  @ManyToOne(() => Booking, { nullable: true })
  @JoinColumn({ name: 'booking_id' })
  booking: Booking | null;

  @Column({ name: 'original_amount', type: 'decimal', precision: 10, scale: 2 })
  originalAmount: number; // Original transaction amount

  @Column({ name: 'refund_amount', type: 'decimal', precision: 10, scale: 2 })
  refundAmount: number; // Amount being refunded

  @Column({ name: 'currency', type: 'varchar', length: 3, default: 'gbp' })
  currency: string;

  @Column({ 
    name: 'status', 
    type: 'enum', 
    enum: RefundStatus, 
    default: RefundStatus.PENDING 
  })
  status: RefundStatus;

  @Column({ 
    name: 'reason', 
    type: 'enum', 
    enum: RefundReason,
    default: RefundReason.OTHER 
  })
  reason: RefundReason;

  @Column({ name: 'reason_details', type: 'text', nullable: true })
  reasonDetails: string | null; // Detailed explanation

  @Column({ name: 'admin_notes', type: 'text', nullable: true })
  adminNotes: string | null; // Internal admin notes

  @Column({ name: 'processed_by', type: 'uuid', nullable: true })
  processedBy: string | null; // Admin user ID who processed

  @Column({ name: 'processed_at', type: 'timestamp', nullable: true })
  processedAt: Date | null;

  @Column({ name: 'stripe_refund_data', type: 'jsonb', nullable: true })
  stripeRefundData: any | null; // Complete Stripe refund response

  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason: string | null;

  @Column({ name: 'wallet_balance_updated', type: 'boolean', default: false })
  walletBalanceUpdated: boolean;

  @Column({ name: 'notification_sent', type: 'boolean', default: false })
  notificationSent: boolean;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;
}