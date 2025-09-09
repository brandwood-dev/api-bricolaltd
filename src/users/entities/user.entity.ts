import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  OneToOne,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { Country } from '../entities/country.entity';
import { UserPreference } from './user-preference.entity';
import { UserSession } from './user-session.entity';
import { UserActivity } from './user-activity.entity';
import { AccountDeletionRequest } from './account-deletion-request.entity';
import { Wallet } from '../../wallets/entities/wallet.entity';
import { Tool } from '../../tools/entities/tool.entity';
import { Booking } from '../../bookings/entities/booking.entity';
import { Review } from '../../reviews/entities/review.entity';
import { Dispute } from '../../disputes/entities/dispute.entity';
import { Document } from '../../documents/entities/document.entity';
import { Bookmark } from '../../bookmarks/entities/bookmark.entity';
import { Notification } from '../../notifications/entities/notification.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'The unique identifier of the user' })
  id: string;

  @Column({ unique: true })
  @ApiProperty({
    description: 'The email of the user',
    example: 'user@example.com',
  })
  email: string;

  @Column({ nullable: true, unique: true, name: 'new_email' })
  @ApiProperty({
    description: 'The new email of the user (for email change process)',
    required: false,
  })
  newEmail?: string;

  @Column()
  @Exclude()
  password: string;

  @Column({
    name: 'is_admin',
    type: 'boolean',
    default: false,
  })
  isAdmin: boolean;

  @Column({ name: 'first_name' })
  @ApiProperty({ description: 'The first name of the user', example: 'John' })
  firstName: string;

  @Column({ name: 'last_name' })
  @ApiProperty({ description: 'The last name of the user', example: 'Doe' })
  lastName: string;

  @Column({ nullable: true, name: 'display_name' })
  @ApiProperty({
    description: 'The display name of the user',
    example: 'JohnD',
    required: false,
  })
  displayName?: string;

  @ManyToOne(() => Country, { nullable: true })
  @JoinColumn({ name: 'country_id' })
  @ApiProperty({ description: 'The country of the user', type: () => Country, required: false })
  country?: Country;

  @Column({ name: 'country_id', type: 'char', length: 2, nullable: true })
  countryId?: string;

  @Column({ name: 'phone_number', nullable: true })
  @ApiProperty({
    description: 'The phone number of the user',
    example: '123456789',
    required: false,
  })
  phoneNumber?: string;

  @Column({ name: 'phone_prefix', nullable: true })
  @ApiProperty({
    description: 'The phone prefix of the user',
    example: '+1',
    required: false,
  })
  phonePrefix?: string;

  @Column({ nullable: true })
  @ApiProperty({ description: 'The address of the user', required: false })
  address?: string;

  @Column({ nullable: true, name: 'city' })
  @ApiProperty({ description: 'The city of the user', required: false })
  city?: string;

  @Column({ nullable: true, name: 'postal_code' })
  @ApiProperty({ description: 'The postal code of the user', required: false })
  postalCode?: string;

  @Column({ nullable: true, name: 'latitude' })
  @ApiProperty({
    description: 'The latitude of the user location',
    required: false,
  })
  latitude?: number;

  @Column({ nullable: true, name: 'longitude' })
  @ApiProperty({
    description: 'The longitude of the user location',
    required: false,
  })
  longitude?: number;

  @Column({ name: 'verify_token', nullable: true })
  verifyToken?: string;

  @Column({ name: 'verify_token_expires', nullable: true })
  verifyTokenExpires?: Date;

  @Column({ name: 'verify_code', nullable: true })
  verifyCode?: string;

  @Column({ name: 'verify_code_expires', nullable: true })
  verifyCodeExpires?: Date;

  @Column({ name: 'verified_email', default: false })
  @ApiProperty({ description: 'Whether the email is verified', default: false })
  verifiedEmail: boolean;

  @Column({ name: 'reset_token', nullable: true })
  resetToken?: string;

  @Column({ name: 'reset_token_expiry', nullable: true })
  resetTokenExpiry?: Date;

  @Column({ name: 'reset_password_token', nullable: true })
  resetPasswordToken?: string;

  @Column({ name: 'reset_password_expires', nullable: true })
  resetPasswordExpires?: Date;

  @Column({ name: 'reset_password_code', nullable: true })
  resetPasswordCode?: string;

  @Column({ name: 'reset_password_code_expires', nullable: true })
  resetPasswordCodeExpires?: Date;

  @Column({ name: 'refresh_token', nullable: true, unique: true })
  refreshToken?: string;

  @Column({ name: 'profile_picture', nullable: true })
  @ApiProperty({
    description: 'The profile picture URL of the user',
    required: false,
  })
  profilePicture?: string;

  @Column({ name: 'is_active', default: true })
  @ApiProperty({ description: 'Whether the user is active', default: true })
  isActive: boolean;

  @Column({ name: 'is_verified', default: false })
  @ApiProperty({ description: 'Whether the user is verified', default: false })
  isVerified: boolean;

  @Column({ name: 'is_suspended', default: false })
  @ApiProperty({ description: 'Whether the user is suspended', default: false })
  isSuspended: boolean;

  @Column({ name: 'must_change_password', default: false })
  @ApiProperty({ description: 'Whether the user must change password on next login', default: false })
  mustChangePassword: boolean;

  @Column({ nullable: true, name: 'verified_at' })
  @ApiProperty({
    description: 'The date when the user was verified',
    required: false,
  })
  verifiedAt?: Date;

  @Column({ nullable: true, name: 'last_login_at' })
  @ApiProperty({ description: 'The date of the last login', required: false })
  lastLoginAt?: Date;

  @Column({ nullable: true, name: 'bio' })
  @ApiProperty({ description: 'The biography of the user', required: false })
  bio?: string;

  @Column({ name: 'user_type', nullable: true })
  @ApiProperty({ description: 'The type of user', required: false })
  userType?: string;

  @Column({ default: 0, name: 'rating_as_owner' })
  @ApiProperty({ description: 'The average rating as a tool owner' })
  ratingAsOwner: number;

  @Column({ default: 0, name: 'rating_as_renter' })
  @ApiProperty({ description: 'The average rating as a tool renter' })
  ratingAsRenter: number;

  @Column({ default: 0, name: 'completed_rentals' })
  @ApiProperty({ description: 'The number of completed rentals' })
  completedRentals: number;

  @Column({ default: 0, name: 'cancelled_rentals' })
  @ApiProperty({ description: 'The number of cancelled rentals' })
  cancelledRentals: number;

  @OneToOne(() => Wallet, (wallet) => wallet.user)
  @ApiProperty({ description: 'The wallet of the user', type: () => Wallet })
  wallet: Wallet;

  @OneToOne(() => UserPreference, (preference) => preference.user)
  @ApiProperty({
    description: 'The preferences of the user',
    type: () => UserPreference,
  })
  preferences: UserPreference;

  @OneToMany(() => Tool, (tool) => tool.owner)
  @ApiProperty({ description: 'The tools owned by the user', type: [Tool] })
  tools: Tool[];

  @OneToMany(() => Booking, (booking) => booking.renter)
  @ApiProperty({
    description: 'The bookings made by the user',
    type: [Booking],
  })
  bookingsAsRenter: Booking[];

  @OneToMany(() => Review, (review) => review.reviewer)
  @ApiProperty({
    description: 'The reviews written by the user',
    type: [Review],
  })
  reviewsGiven: Review[];

  @OneToMany(() => Review, (review) => review.reviewee)
  @ApiProperty({
    description: 'The reviews received by the user',
    type: [Review],
  })
  reviewsReceived: Review[];

  @OneToMany(() => Dispute, (dispute) => dispute.initiator)
  @ApiProperty({
    description: 'The disputes initiated by the user',
    type: [Dispute],
  })
  disputesInitiated: Dispute[];

  @OneToMany(() => Dispute, (dispute) => dispute.respondent)
  @ApiProperty({
    description: 'The disputes where the user is the respondent',
    type: [Dispute],
  })
  disputesReceived: Dispute[];

  @OneToMany(() => Document, (document) => document.user)
  @ApiProperty({
    description: 'The documents uploaded by the user',
    type: [Document],
  })
  documents: Document[];

  @OneToMany(() => Bookmark, (bookmark) => bookmark.user)
  @ApiProperty({
    description: 'The bookmarks created by the user',
    type: [Bookmark],
  })
  bookmarks: Bookmark[];

  @OneToMany(() => Notification, (notification) => notification.user)
  @ApiProperty({
    description: 'The notifications received by the user',
    type: [Notification],
  })
  notifications: Notification[];

  @OneToMany(() => UserSession, (session) => session.user)
  @ApiProperty({
    description: 'The active sessions of the user',
    type: [UserSession],
  })
  sessions: UserSession[];

  @OneToMany(() => UserActivity, (activity) => activity.user)
  @ApiProperty({
    description: 'The activity history of the user',
    type: [UserActivity],
  })
  activities: UserActivity[];

  @OneToMany(() => AccountDeletionRequest, (request) => request.user)
  @ApiProperty({
    description: 'The account deletion requests made by the user',
    type: () => [AccountDeletionRequest],
  })
  accountDeletionRequests: AccountDeletionRequest[];

  @OneToMany(() => Transaction, (transaction) => transaction.sender)
  @ApiProperty({
    description: 'The transactions sent by the user',
    type: () => [Transaction],
  })
  transactionsSent: Transaction[];

  @OneToMany(() => Transaction, (transaction) => transaction.recipient)
  @ApiProperty({
    description: 'The transactions received by the user',
    type: () => [Transaction],
  })
  transactionsReceived: Transaction[];

  @CreateDateColumn({ name: 'created_at' })
  @ApiProperty({ description: 'The date when the user was created' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  @ApiProperty({ description: 'The date when the user was last updated' })
  updatedAt: Date;
}
