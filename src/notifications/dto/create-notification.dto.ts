import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsBoolean, IsUUID } from 'class-validator';
import { NotificationType } from '../enums/notification-type';

export class CreateNotificationDto {
  @ApiProperty({
    description: 'The title of the notification',
    example: 'New booking request',
  })
  @IsString()
  title: string;

  @ApiProperty({
    description: 'The message content of the notification',
    example: 'You have received a new booking request for your tool.',
  })
  @IsString()
  message: string;

  @ApiProperty({
    description: 'The type of notification',
    enum: NotificationType,
    example: NotificationType.BOOKING_CREATED,
  })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({
    description: 'The ID of the user who will receive the notification',
    example: 'uuid-string',
  })
  @IsUUID()
  userId: string;

  @ApiProperty({
    description: 'Optional link associated with the notification',
    example: '/bookings/123',
    required: false,
  })
  @IsOptional()
  @IsString()
  link?: string;

  @ApiProperty({
    description: 'ID of related entity (booking, tool, etc.)',
    example: 'uuid-string',
    required: false,
  })
  @IsOptional()
  @IsString()
  relatedId?: string;

  @ApiProperty({
    description: 'Type of related entity',
    example: 'booking',
    required: false,
  })
  @IsOptional()
  @IsString()
  relatedType?: string;

  @ApiProperty({
    description: 'Whether this is a system notification',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isSystem?: boolean;
}