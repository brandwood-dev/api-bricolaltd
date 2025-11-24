import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('stripe_webhook_events')
@Index(['eventId'], { unique: true })
@Index(['createdAt'])
export class StripeWebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_id', type: 'varchar', length: 255, unique: true })
  eventId: string;

  @Column({ name: 'event_type', type: 'varchar', length: 100 })
  eventType: string;

  @Column({ name: 'payload', type: 'jsonb' })
  payload: any;

  @Column({ name: 'processed', type: 'boolean', default: false })
  processed: boolean;

  @Column({ name: 'processing_error', type: 'text', nullable: true })
  processingError: string | null;

  @Column({ name: 'retry_count', type: 'int', default: 0 })
  retryCount: number;

  @Column({ name: 'last_retry_at', type: 'timestamp', nullable: true })
  lastRetryAt: Date | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'processed_at', type: 'timestamp', nullable: true })
  processedAt: Date | null;
}
