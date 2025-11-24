import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum BlockReason {
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  MULTIPLE_FAILED_LOGINS = 'multiple_failed_logins',
  SPAM = 'spam',
  ABUSE = 'abuse',
  MANUAL_BLOCK = 'manual_block',
  AUTOMATED_BLOCK = 'automated_block',
}

@Entity({ name: 'blocked_ips' })
export class BlockedIp {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({
    description: 'The unique identifier of the blocked IP record',
  })
  id: string;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, unique: true })
  @ApiProperty({ description: 'The blocked IP address' })
  ipAddress: string;

  @Column({ name: 'reason', type: 'enum', enum: BlockReason })
  @ApiProperty({
    description: 'The reason for blocking the IP',
    enum: BlockReason,
  })
  reason: BlockReason;

  @Column({ name: 'description', type: 'text', nullable: true })
  @ApiProperty({
    description: 'Additional description for the block',
    required: false,
  })
  description: string | null;

  @Column({ name: 'blocked_by', type: 'varchar', length: 36, nullable: true })
  @ApiProperty({
    description: 'ID of the admin who blocked the IP',
    required: false,
  })
  blockedBy: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  @ApiProperty({ description: 'Whether the IP block is currently active' })
  isActive: boolean;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  @ApiProperty({
    description: 'When the IP block expires (null for permanent)',
    required: false,
  })
  expiresAt: Date | null;

  @Column({ name: 'attempt_count', type: 'integer', default: 0 })
  @ApiProperty({
    description: 'Number of attempts from this IP after blocking',
  })
  attemptCount: number;

  @Column({ name: 'last_attempt_at', type: 'timestamp', nullable: true })
  @ApiProperty({
    description: 'Last attempt timestamp from this IP',
    required: false,
  })
  lastAttemptAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  @ApiProperty({ description: 'The date when the IP was blocked' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  @ApiProperty({
    description: 'The date when the block record was last updated',
  })
  updatedAt: Date;
}
