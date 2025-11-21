import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { ThreeDSStatus } from '../enums/three-ds-status.enum';

@Entity('three_d_secure_sessions')
@Index(['paymentIntentId'])
@Index(['userId'])
@Index(['sessionId'])
@Index(['status'])
@Index(['initiatedAt'])
export class ThreeDSecureSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'session_id', unique: true })
  sessionId: string;

  @Column({ name: 'payment_intent_id' })
  paymentIntentId: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'transaction_id', nullable: true })
  transactionId?: string;

  @Column({ name: 'booking_id', nullable: true })
  bookingId?: string;

  @Column({ 
    type: 'enum',
    enum: ThreeDSStatus,
    default: ThreeDSStatus.INITIATED
  })
  status: ThreeDSStatus;

  @Column({ name: 'amount', type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ name: 'currency', length: 3, default: 'gbp' })
  currency: string;

  @Column({ name: 'card_brand', length: 50, nullable: true })
  cardBrand?: string;

  @Column({ name: 'card_last4', length: 4, nullable: true })
  cardLast4?: string;

  @Column({ name: 'card_country', length: 2, nullable: true })
  cardCountry?: string;

  @Column({ name: 'challenge_indicator', length: 50, nullable: true })
  challengeIndicator?: string;

  @Column({ name: 'authentication_method', length: 50, nullable: true })
  authenticationMethod?: string;

  @Column({ name: 'authentication_flow', length: 50, nullable: true })
  authenticationFlow?: 'frictionless' | 'challenge';

  @Column({ name: 'ip_address', length: 45, nullable: true })
  ipAddress?: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string;

  @Column({ name: 'device_info', type: 'jsonb', nullable: true })
  deviceInfo?: {
    screenResolution?: string;
    timezone?: string;
    language?: string;
    colorDepth?: number;
    javaEnabled?: boolean;
    javascriptEnabled?: boolean;
    acceptHeaders?: string;
    userAgent?: string;
  };

  @Column({ name: 'billing_details', type: 'jsonb', nullable: true })
  billingDetails?: {
    name: string;
    email: string;
    phone?: string;
    address?: {
      line1: string;
      line2?: string;
      city: string;
      state?: string;
      postalCode: string;
      country: string;
    };
  };

  @Column({ name: 'three_ds_version', length: 10, nullable: true })
  threeDSVersion?: string;

  @Column({ name: 'eci', length: 2, nullable: true })
  eci?: string; // Electronic Commerce Indicator

  @Column({ name: 'cavv', length: 50, nullable: true })
  cavv?: string; // Cardholder Authentication Verification Value

  @Column({ name: 'ds_trans_id', length: 50, nullable: true })
  dsTransId?: string; // Directory Server Transaction ID

  @Column({ name: 'acs_trans_id', length: 50, nullable: true })
  acsTransId?: string; // Access Control Server Transaction ID

  @Column({ name: 'error_code', length: 50, nullable: true })
  errorCode?: string;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ name: 'risk_score', type: 'decimal', precision: 5, scale: 2, nullable: true })
  riskScore?: number;

  @Column({ name: 'risk_factors', type: 'jsonb', nullable: true })
  riskFactors?: {
    amount?: number;
    currency?: string;
    cardCountry?: string;
    ipCountry?: string;
    timeOfDay?: number;
    dayOfWeek?: number;
    deviceFingerprint?: string;
    emailDomain?: string;
    velocity?: number;
  };

  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn({ name: 'initiated_at' })
  initiatedAt: Date;

  @Column({ name: 'completed_at', nullable: true })
  completedAt?: Date;

  @Column({ name: 'expires_at' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Helper methods
  isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  isCompleted(): boolean {
    return this.status === ThreeDSStatus.COMPLETED || 
           this.status === ThreeDSStatus.FAILED ||
           this.status === ThreeDSStatus.EXPIRED;
  }

  isChallengeRequired(): boolean {
    return this.status === ThreeDSStatus.CHALLENGE_REQUIRED;
  }

  isFrictionless(): boolean {
    return this.status === ThreeDSStatus.FRICTIONLESS_COMPLETED;
  }

  getProcessingTime(): number | null {
    if (!this.completedAt || !this.initiatedAt) {
      return null;
    }
    return this.completedAt.getTime() - this.initiatedAt.getTime();
  }

  // Generate unique session ID
  static generateSessionId(): string {
    return `3ds_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}