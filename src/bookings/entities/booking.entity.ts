import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../users/entities/user.entity';
import { Tool } from '../../tools/entities/tool.entity';
import { BookingStatus } from '../enums/booking-status.enum';
import { DepositCaptureStatus } from '../enums/deposit-capture-status.enum';

@Entity('booking')
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'The unique identifier of the booking' })
  id: string;

  @Column({ name: 'start_date', type: 'date' })
  @ApiProperty({ description: 'The start date of the booking' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'date' })
  @ApiProperty({ description: 'The end date of the booking' })
  endDate: Date;

  @Column({ name: 'pickup_hour', type: 'time' })
  @ApiProperty({ description: 'The pickup hour of the booking' })
  pickupHour: Date;

  @Column({ name: 'total_price', type: 'decimal', precision: 10, scale: 2 })
  @ApiProperty({
    description: 'The total price of the booking',
    example: 150.0,
  })
  totalPrice: number;

  @Column({ type: 'text', nullable: true })
  @ApiProperty({ description: 'Message from the renter', required: false })
  message?: string;

  @Column({
    name: 'payment_method',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  @ApiProperty({ description: 'The payment method used', required: false })
  paymentMethod?: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: BookingStatus,
    default: BookingStatus.PENDING,
  })
  @ApiProperty({ description: 'The status of the booking', example: 'PENDING' })
  status: BookingStatus;

  @ManyToOne(() => Tool, (tool) => tool.bookings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tool_id' })
  @ApiProperty({ description: 'The tool that was booked', type: () => Tool })
  tool: Tool;

  @Column({ name: 'tool_id' })
  toolId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'renter_id' })
  @ApiProperty({
    description: 'The user who rented the tool',
    type: () => User,
  })
  renter: User;

  @Column({ name: 'renter_id' })
  renterId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  @ApiProperty({
    description: 'The owner of the tool',
    type: () => User,
  })
  owner: User;

  @Column({ name: 'owner_id' })
  ownerId: string;

  @Column({ name: 'validation_code', nullable: true })
  @ApiProperty({
    description: 'The validation code for the booking',
    required: false,
  })
  validationCode?: string;

  @Column({ name: 'has_active_claim', default: false })
  @ApiProperty({
    description: 'Indicates if there is an active claim for the booking',
    default: false,
  })
  hasActiveClaim?: boolean;

  @Column({ name: 'cancellation_reason', nullable: true })
  @ApiProperty({ description: 'The reason for cancellation', required: false })
  cancellationReason?: string;

  @Column({ name: 'cancellation_message', nullable: true })
  @ApiProperty({ description: 'The message for cancellation', required: false })
  cancellationMessage?: string;

  @Column({ name: 'renter_has_returned', default: false })
  @ApiProperty({
    description: 'Indicates if the renter has returned the tool',
    default: false,
  })
  renterHasReturned?: boolean;

  @Column({ name: 'has_used_return_button', default: false })
  @ApiProperty({
    description: 'Indicates if the renter has used the return button',
    default: false,
  })
  hasUsedReturnButton?: boolean;

  @Column({ name: 'refusal_reason', nullable: true })
  @ApiProperty({ description: 'The reason for refusal', required: false })
  refusalReason?: string;

  @Column({ name: 'refusal_message', nullable: true })
  @ApiProperty({ description: 'The message for refusal', required: false })
  refusalMessage?: string;

  @Column({ name: 'pickup_tool', default: false })
  @ApiProperty({
    description: 'Indicates if the tool has been picked up by the owner',
    default: false,
  })
  pickupTool?: boolean;

  // Payment-related fields for Stripe integration
  @Column({ name: 'payment_intent_id', nullable: true })
  @ApiProperty({
    description: 'Stripe Payment Intent ID for this booking',
    required: false,
  })
  paymentIntentId?: string;

  @Column({ 
    name: 'payment_status', 
    type: 'enum',
    enum: ['pending', 'authorized', 'captured', 'failed', 'cancelled', 'refunded'],
    default: 'pending'
  })
  @ApiProperty({
    description: 'Payment status for this booking',
    enum: ['pending', 'authorized', 'captured', 'failed', 'cancelled', 'refunded'],
    default: 'pending',
  })
  paymentStatus: string;

  @Column({ name: 'payment_holds', type: 'json', nullable: true })
  @ApiProperty({
    description: 'JSON object containing payment hold information',
    required: false,
  })
  paymentHolds?: any;

  @Column({ name: 'stripe_customer_id', nullable: true })
  @ApiProperty({
    description: 'Stripe Customer ID for the renter',
    required: false,
  })
  stripeCustomerId?: string;

  @Column({ name: 'payment_captured_at', type: 'timestamp', nullable: true })
  @ApiProperty({
    description: 'Timestamp when payment was captured',
    required: false,
  })
  paymentCapturedAt?: Date;

  @Column({ name: 'refund_amount', type: 'decimal', precision: 10, scale: 2, nullable: true })
  @ApiProperty({
    description: 'Amount refunded for this booking',
    required: false,
  })
  refundAmount?: number;

  @Column({ name: 'refund_reason', nullable: true })
  @ApiProperty({
    description: 'Reason for refund',
    required: false,
  })
  refundReason?: string;

  @Column({ name: 'cancelled_at', type: 'timestamp', nullable: true })
  @ApiProperty({
    description: 'Timestamp when booking was cancelled',
    required: false,
  })
  cancelledAt?: Date;

  // Deposit automation fields
  @Column({ name: 'setup_intent_id', nullable: true })
  @ApiProperty({
    description: 'Stripe SetupIntent ID for deposit payment method',
    required: false,
  })
  setupIntentId?: string;

  @Column({ name: 'deposit_payment_method_id', nullable: true })
  @ApiProperty({
    description: 'Stripe Payment Method ID for deposit capture',
    required: false,
  })
  depositPaymentMethodId?: string;

  @Column({ name: 'deposit_capture_scheduled_at', type: 'timestamp', nullable: true })
  @ApiProperty({
    description: 'When the deposit capture is scheduled',
    required: false,
  })
  depositCaptureScheduledAt?: Date;

  @Column({ name: 'deposit_notification_sent_at', type: 'timestamp', nullable: true })
  @ApiProperty({
    description: 'When the deposit notification was sent',
    required: false,
  })
  depositNotificationSentAt?: Date;

  @Column({ name: 'deposit_captured_at', type: 'timestamp', nullable: true })
  @ApiProperty({
    description: 'When the deposit was captured',
    required: false,
  })
  depositCapturedAt?: Date;

  @Column({
    name: 'deposit_capture_status',
    type: 'enum',
    enum: DepositCaptureStatus,
    default: DepositCaptureStatus.PENDING,
  })
  @ApiProperty({
    description: 'Status of the deposit capture',
    enum: DepositCaptureStatus,
    default: DepositCaptureStatus.PENDING,
  })
  depositCaptureStatus: DepositCaptureStatus;

  @Column({ name: 'deposit_failure_reason', type: 'text', nullable: true })
  @ApiProperty({
    description: 'Reason for deposit capture failure',
    required: false,
  })
  depositFailureReason?: string;

  @CreateDateColumn({ name: 'created_at' })
  @ApiProperty({ description: 'The date when the booking was created' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  @ApiProperty({ description: 'The date when the booking was last updated' })
  updatedAt: Date;
}
