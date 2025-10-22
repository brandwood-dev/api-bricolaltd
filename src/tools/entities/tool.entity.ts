import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { forwardRef, Inject } from '@nestjs/common';
import { User } from '../../users/entities/user.entity';
import { Currency } from '../../users/entities/currency.entity';
import { Booking } from '../../bookings/entities/booking.entity';
import { Bookmark } from '../../bookmarks/entities/bookmark.entity';
import { Category } from '../../categories/entities/category.entity';
import { Subcategory } from '../../categories/entities/subcategory.entity';
import { ToolPhoto } from './tool-photo.entity';
import { ToolCondition } from '../enums/tool-condition.enum';
import { ToolStatus } from '../enums/tool-status.enum';
import { AvailabilityStatus } from '../enums/availability-status.enum';
import { ModerationStatus } from '../enums/moderation-status.enum';


@Entity('tools')  // Changed from 'tool' to 'tools'
export class Tool {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'The unique identifier of the tool' })
  id: string;

  @Column()
  @ApiProperty({
    description: 'The title of the tool',
    example: 'Professional Hammer',
  })
  title: string;

  @Column({ name: 'description', type: 'longtext' })
  @ApiProperty({ description: 'The description of the tool' })
  description: string;

  @Column({ nullable: true })
  @ApiProperty({
    description: 'The brand of the tool',
    example: 'DeWalt',
    required: false,
  })
  brand?: string;

  @Column({ nullable: true })
  @ApiProperty({
    description: 'The model of the tool',
    example: 'DW123',
    required: false,
  })
  model?: string;

  @Column({ type: 'year', nullable: true })
  @ApiProperty({
    description: 'The year of the tool',
    example: 2022,
    required: false,
  })
  year?: number;

  @Column({
    name: 'condition',
    type: 'enum',
    enum: ToolCondition,
    default: ToolCondition.GOOD,
  })
  @ApiProperty({
    description: 'The condition of the tool',
    enum: ToolCondition,
    example: ToolCondition.GOOD,
  })
  condition: ToolCondition;

  @Column({ name: 'pickup_address', type: 'longtext' })
  @ApiProperty({ description: 'The pickup address for the tool' })
  pickupAddress: string;

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  @ApiProperty({
    description: 'The latitude of the pickup location',
    required: false,
  })
  latitude?: number;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  @ApiProperty({
    description: 'The longitude of the pickup location',
    required: false,
  })
  longitude?: number;

  @Column({ name: 'owner_instructions', type: 'longtext', nullable: true })
  @ApiProperty({ description: 'Instructions from the owner', required: false })
  ownerInstructions?: string;

  @Column({ name: 'base_price', type: 'decimal', precision: 10, scale: 2 })
  @ApiProperty({ description: 'The base price of the tool', example: 25.99 })
  basePrice: number;

  @Column({ name: 'deposit_amount', type: 'decimal', precision: 10, scale: 2 })
  @ApiProperty({
    description: 'The deposit amount for the tool',
    example: 100.0,
  })
  depositAmount: number;

  @ManyToOne('Currency', { nullable: true })
  @JoinColumn({ name: 'base_currency_code' })
  @ApiProperty({
    description: 'The base currency for the tool pricing',
    type: () => Currency,
    required: false,
  })
  baseCurrency?: Currency;

  @Column({ name: 'base_currency_code', type: 'char', length: 3, nullable: true, default: 'GBP' })
  baseCurrencyCode?: string;

  @Column({ nullable: true })
  @ApiProperty({
    description: 'The URL of the tool image',
    example: 'https://example-bucket.s3.amazonaws.com/tools/image.jpg',
    required: false,
  })
  imageUrl?: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: ToolStatus,
    default: ToolStatus.DRAFT,
  })
  @ApiProperty({
    description: 'The publication status of the tool',
    enum: ToolStatus,
    example: ToolStatus.PUBLISHED,
  })
  toolStatus: ToolStatus;

  @Column({
    name: 'availability_status',
    type: 'enum',
    enum: AvailabilityStatus,
    default: AvailabilityStatus.AVAILABLE,
  })
  @ApiProperty({
    description: 'The availability status of the tool',
    enum: AvailabilityStatus,
    example: AvailabilityStatus.AVAILABLE,
  })
  availabilityStatus: AvailabilityStatus;

  @ManyToOne(() => Category)
  @JoinColumn({ name: 'category_id' })
  @ApiProperty({
    description: 'The category of the tool',
    type: () => Category,
  })
  category: Category;

  @Column({ name: 'category_id' })
  categoryId: string;

  @ManyToOne(() => Subcategory)
  @JoinColumn({ name: 'subcategory_id' })
  @ApiProperty({
    description: 'The subcategory of the tool',
    type: () => Subcategory,
  })
  subcategory: Subcategory;

  @Column({ name: 'subcategory_id' })
  subcategoryId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  @ApiProperty({ description: 'The user who owns the tool', type: () => User })
  owner: User;

  @Column({ name: 'owner_id' })
  ownerId: string;

  @CreateDateColumn({ name: 'created_at' })
  @ApiProperty({ description: 'The date when the tool was created' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  @ApiProperty({ description: 'The date when the tool was last updated' })
  updatedAt: Date;

  @Column({ name: 'published_at', nullable: true })
  @ApiProperty({
    description: 'The date when the tool was published',
    required: false,
  })
  publishedAt?: Date;

  @Column({
    name: 'moderation_status',
    type: 'enum',
    enum: ModerationStatus,
    default: ModerationStatus.PENDING,
  })
  @ApiProperty({
    description: 'The moderation status of the tool',
    enum: ModerationStatus,
    example: ModerationStatus.PENDING,
  })
  moderationStatus: ModerationStatus;

  @Column({ name: 'rejection_reason', type: 'varchar', length: 500, nullable: true })
  @ApiProperty({
    description: 'The reason for rejection if the tool was rejected',
    example: 'Contenu inapproprié',
    required: false,
  })
  rejectionReason?: string;

  @OneToMany(() => Booking, (booking) => booking.tool)
  @ApiProperty({
    description: 'The bookings associated with this tool',
    type: [Booking],
  })
  bookings: Booking[];

  @OneToMany(() => Bookmark, (bookmark) => bookmark.tool)
  @ApiProperty({
    description: 'The bookmarks associated with this tool',
    type: [Bookmark],
  })
  bookmarks: Bookmark[];

  @OneToMany(() => ToolPhoto, (photo) => photo.tool)
  @ApiProperty({
    description: 'The photos associated with this tool',
    type: [ToolPhoto],
  })
  photos: ToolPhoto[];

  @ApiProperty({
    description: 'Whether the tool is available for booking',
    example: true,
  })
  get isAvailable(): boolean {
    return this.availabilityStatus === AvailabilityStatus.AVAILABLE;
  }

  @ApiProperty({
    description: 'The primary image URL of the tool',
    example: 'https://example-bucket.s3.amazonaws.com/tools/image.jpg',
    required: false,
  })
  get image(): string | null {
    if (!this.photos || this.photos.length === 0) {
      return null;
    }
    const primaryPhoto = this.photos.find(photo => photo.isPrimary);
    return primaryPhoto ? primaryPhoto.url : (this.photos[0]?.url || null);
  }
}
