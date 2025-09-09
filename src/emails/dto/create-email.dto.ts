import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID, IsString, IsOptional, IsBoolean, IsEnum } from 'class-validator';

export enum EmailType {
  NOTIFICATION = 'NOTIFICATION',
  BOOKING_CONFIRMATION = 'BOOKING_CONFIRMATION',
  PAYMENT_CONFIRMATION = 'PAYMENT_CONFIRMATION',
  ACCOUNT_VERIFICATION = 'ACCOUNT_VERIFICATION',
  PASSWORD_RESET = 'PASSWORD_RESET',
  GENERAL = 'GENERAL',
}

export class CreateEmailDto {
  @ApiProperty({
    description: 'The ID of the user who will receive this email',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  @IsUUID()
  userId: string;

  @ApiProperty({
    description: 'The subject of the email',
    example: 'Your booking has been confirmed',
  })
  @IsNotEmpty()
  @IsString()
  subject: string;

  @ApiProperty({
    description: 'The content of the email',
    example: 'Dear user, your booking #12345 has been confirmed. Thank you for using our service.',
  })
  @IsNotEmpty()
  @IsString()
  content: string;

  @ApiProperty({
    description: 'The type of email',
    enum: EmailType,
    example: EmailType.BOOKING_CONFIRMATION,
  })
  @IsNotEmpty()
  @IsEnum(EmailType)
  type: string;

  @ApiProperty({
    description: 'Whether the email has been read by the user',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isRead: boolean = false;

  @ApiProperty({
    description: 'Reference ID related to this email (e.g., booking ID, payment ID)',
    example: '123e4567-e89b-12d3-a456-426614174001',
    required: false,
  })
  @IsOptional()
  @IsString()
  referenceId?: string;
}