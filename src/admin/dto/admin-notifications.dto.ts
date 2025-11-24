import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsUUID,
  IsBoolean,
} from 'class-validator';

export enum NotificationType {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
  SYSTEM = 'system',
}

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum NotificationCategory {
  BOOKING = 'booking',
  USER = 'user',
  SYSTEM = 'system',
  PAYMENT = 'payment',
  DISPUTE = 'dispute',
  SECURITY = 'security',
}

export class CreateAdminNotificationDto {
  @ApiProperty({ description: 'Notification title' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Notification message' })
  @IsString()
  message: string;

  @ApiProperty({
    description: 'Notification type',
    enum: NotificationType,
    default: NotificationType.INFO,
  })
  @IsEnum(NotificationType)
  @IsOptional()
  type?: NotificationType = NotificationType.INFO;

  @ApiProperty({
    description: 'Notification priority',
    enum: NotificationPriority,
    default: NotificationPriority.MEDIUM,
  })
  @IsEnum(NotificationPriority)
  @IsOptional()
  priority?: NotificationPriority = NotificationPriority.MEDIUM;

  @ApiProperty({
    description: 'Notification category',
    enum: NotificationCategory,
    default: NotificationCategory.SYSTEM,
  })
  @IsEnum(NotificationCategory)
  @IsOptional()
  category?: NotificationCategory = NotificationCategory.SYSTEM;

  @ApiProperty({ description: 'Related user ID', required: false })
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiProperty({ description: 'Related user name', required: false })
  @IsString()
  @IsOptional()
  userName?: string;

  // Metadata field removed to fix row size too large issue
  // @ApiProperty({ description: 'Additional metadata', required: false })
  // @IsOptional()
  // metadata?: Record<string, any>;

  @ApiProperty({
    description: 'Auto-read after specified time (in minutes)',
    required: false,
  })
  @IsOptional()
  autoReadAfter?: number;
}

export class MarkNotificationsReadDto {
  @ApiProperty({
    description: 'Array of notification IDs to mark as read',
    type: [String],
  })
  @IsArray()
  @IsUUID(4, { each: true })
  notificationIds: string[];
}

export class DeleteNotificationsDto {
  @ApiProperty({
    description: 'Array of notification IDs to delete',
    type: [String],
  })
  @IsArray()
  @IsUUID(4, { each: true })
  notificationIds: string[];
}

export class AdminNotificationFilterDto {
  @ApiProperty({ description: 'Page number', required: false, default: 1 })
  @IsOptional()
  page?: number = 1;

  @ApiProperty({ description: 'Items per page', required: false, default: 50 })
  @IsOptional()
  limit?: number = 50;

  @ApiProperty({
    description: 'Filter by notification type',
    enum: NotificationType,
    required: false,
  })
  @IsEnum(NotificationType)
  @IsOptional()
  type?: NotificationType;

  @ApiProperty({
    description: 'Filter by notification category',
    enum: NotificationCategory,
    required: false,
  })
  @IsEnum(NotificationCategory)
  @IsOptional()
  category?: NotificationCategory;

  @ApiProperty({
    description: 'Filter by notification priority',
    enum: NotificationPriority,
    required: false,
  })
  @IsEnum(NotificationPriority)
  @IsOptional()
  priority?: NotificationPriority;

  @ApiProperty({ description: 'Filter by read status', required: false })
  @IsBoolean()
  @IsOptional()
  isRead?: boolean;

  @ApiProperty({
    description: 'Search term for title/message',
    required: false,
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiProperty({ description: 'Filter by user ID', required: false })
  @IsUUID()
  @IsOptional()
  userId?: string;
}
