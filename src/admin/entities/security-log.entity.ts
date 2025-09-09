import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../users/entities/user.entity';

export enum SecurityEventType {
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILED = 'login_failed',
  LOGOUT = 'logout',
  PASSWORD_CHANGE = 'password_change',
  PROFILE_UPDATE = 'profile_update',
  ADMIN_ACTION = 'admin_action',
  ADMIN_ACCESS = 'admin_access',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  IP_BLOCKED = 'ip_blocked',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  SESSION_TERMINATED = 'session_terminated',
}

export enum SecuritySeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

@Entity({ name: 'security_logs' })
@Index(['eventType', 'createdAt'])
@Index(['userId', 'createdAt'])
@Index(['ipAddress', 'createdAt'])
export class SecurityLog {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'The unique identifier of the security log' })
  id: string;

  @Column({ name: 'user_id', nullable: true })
  @ApiProperty({ description: 'The ID of the user associated with the event', required: false })
  userId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  @ApiProperty({ description: 'The user associated with the event', type: () => User, required: false })
  user: User | null;

  @Column({ name: 'event_type', type: 'enum', enum: SecurityEventType })
  @ApiProperty({ description: 'The type of security event', enum: SecurityEventType })
  eventType: SecurityEventType;

  @Column({ name: 'severity', type: 'enum', enum: SecuritySeverity, default: SecuritySeverity.LOW })
  @ApiProperty({ description: 'The severity level of the event', enum: SecuritySeverity })
  severity: SecuritySeverity;

  @Column({ name: 'description', type: 'longtext' })
  @ApiProperty({ description: 'Description of the security event' })
  description: string;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  @ApiProperty({ description: 'The IP address from which the event occurred', required: false })
  ipAddress: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 500, nullable: true })
  @ApiProperty({ description: 'The user agent string', required: false })
  userAgent: string | null;

  @Column({ name: 'device_type', type: 'varchar', length: 50, nullable: true })
  @ApiProperty({ description: 'The type of device used', required: false })
  deviceType: string | null;

  @Column({ name: 'location', type: 'varchar', length: 100, nullable: true })
  @ApiProperty({ description: 'Geographic location of the event', required: false })
  location: string | null;

  @Column({ name: 'resource', type: 'varchar', length: 255, nullable: true })
  @ApiProperty({ description: 'The resource or endpoint accessed', required: false })
  resource: string | null;

  @Column({ name: 'method', type: 'varchar', length: 10, nullable: true })
  @ApiProperty({ description: 'HTTP method used', required: false })
  method: string | null;

  @Column({ name: 'status_code', type: 'integer', nullable: true })
  @ApiProperty({ description: 'HTTP status code', required: false })
  statusCode: number | null;

  @Column({ name: 'metadata', type: 'longtext', nullable: true })
  @ApiProperty({ description: 'Additional metadata about the event', required: false })
  metadata: string | null;

  @Column({ name: 'session_id', type: 'varchar', length: 255, nullable: true })
  @ApiProperty({ description: 'Session ID associated with the event', required: false })
  sessionId: string | null;

  @Column({ name: 'is_resolved', type: 'boolean', default: false })
  @ApiProperty({ description: 'Whether the security incident has been resolved' })
  isResolved: boolean;

  @Column({ name: 'resolved_by', type: 'varchar', length: 36, nullable: true })
  @ApiProperty({ description: 'ID of the admin who resolved the incident', required: false })
  resolvedBy: string | null;

  @Column({ name: 'resolved_at', type: 'timestamp', nullable: true })
  @ApiProperty({ description: 'When the incident was resolved', required: false })
  resolvedAt: Date | null;

  @Column({ name: 'notes', type: 'longtext', nullable: true })
  @ApiProperty({ description: 'Additional notes about the incident', required: false })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  @ApiProperty({ description: 'The date when the security log was created' })
  createdAt: Date;
}