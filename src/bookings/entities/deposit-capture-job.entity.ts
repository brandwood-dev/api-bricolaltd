import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Booking } from './booking.entity';
import { DepositJobStatus } from '../enums/deposit-job-status.enum';

@Entity('deposit_capture_jobs')
@Index(['scheduledAt'])
@Index(['status'])
@Index(['bookingId'])
export class DepositCaptureJob {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'The unique identifier of the deposit capture job' })
  id: string;

  @Column({ name: 'booking_id' })
  @ApiProperty({ description: 'The booking ID this job is associated with' })
  bookingId: string;

  @ManyToOne(() => Booking, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'booking_id' })
  @ApiProperty({ description: 'The booking this job is associated with', type: () => Booking })
  booking: Booking;

  @Column({ name: 'scheduled_at', type: 'timestamp' })
  @ApiProperty({ description: 'When the deposit capture is scheduled' })
  scheduledAt: Date;

  @Column({ name: 'notification_sent_at', type: 'timestamp', nullable: true })
  @ApiProperty({ description: 'When the notification was sent', required: false })
  notificationSentAt?: Date;

  @Column({ name: 'capture_attempted_at', type: 'timestamp', nullable: true })
  @ApiProperty({ description: 'When the capture was attempted', required: false })
  captureAttemptedAt?: Date;

  @Column({
    name: 'status',
    type: 'enum',
    enum: DepositJobStatus,
    default: DepositJobStatus.SCHEDULED,
  })
  @ApiProperty({ 
    description: 'The status of the deposit capture job',
    enum: DepositJobStatus,
    default: DepositJobStatus.SCHEDULED,
  })
  status: DepositJobStatus;

  @Column({ name: 'retry_count', type: 'int', default: 0 })
  @ApiProperty({ description: 'Number of retry attempts', default: 0 })
  retryCount: number;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  @ApiProperty({ description: 'Last error message if any', required: false })
  lastError?: string;

  @Column({ name: 'metadata', type: 'json', nullable: true })
  @ApiProperty({ description: 'Additional metadata for the job', required: false })
  metadata?: any;

  @CreateDateColumn({ name: 'created_at' })
  @ApiProperty({ description: 'The date when the job was created' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  @ApiProperty({ description: 'The date when the job was last updated' })
  updatedAt: Date;
}