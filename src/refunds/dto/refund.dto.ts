import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min, Max, Length, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { RefundReason, RefundStatus } from '../entities/refund.entity';

export class CreateRefundDto {
  @ApiProperty({ description: 'Transaction ID to refund', example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  transactionId: string;

  @ApiProperty({ description: 'Amount to refund (optional - defaults to full amount)', example: 50.00, required: false })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Refund amount must be at least £0.01' })
  @Max(10000, { message: 'Refund amount cannot exceed £10,000' })
  amount?: number;

  @ApiProperty({ description: 'Reason for refund', enum: RefundReason, example: RefundReason.CUSTOMER_REQUEST })
  @IsEnum(RefundReason)
  reason: RefundReason;

  @ApiProperty({ description: 'Detailed explanation for refund', example: 'Customer requested refund due to service issues', required: false })
  @IsOptional()
  @IsString()
  @Length(0, 500, { message: 'Reason details must be less than 500 characters' })
  reasonDetails?: string;

  @ApiProperty({ description: 'Notify user via email', example: true, default: true })
  @IsOptional()
  @IsBoolean()
  notifyUser?: boolean = true;

  @ApiProperty({ description: 'Admin notes (internal use)', example: 'Approved by supervisor', required: false })
  @IsOptional()
  @IsString()
  @Length(0, 1000, { message: 'Admin notes must be less than 1000 characters' })
  adminNotes?: string;
}

export class ProcessRefundDto {
  @ApiProperty({ description: 'Refund ID to process', example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  refundId: string;

  @ApiProperty({ description: 'Amount to refund (must match original request)', example: 50.00 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Refund amount must be at least £0.01' })
  @Max(10000, { message: 'Refund amount cannot exceed £10,000' })
  amount: number;

  @ApiProperty({ description: 'Admin notes', example: 'Refund processed successfully', required: false })
  @IsOptional()
  @IsString()
  adminNotes?: string;
}

export class UpdateRefundStatusDto {
  @ApiProperty({ description: 'New refund status', enum: RefundStatus, example: RefundStatus.COMPLETED })
  @IsEnum(RefundStatus)
  status: RefundStatus;

  @ApiProperty({ description: 'Reason for status change', example: 'Refund processed successfully', required: false })
  @IsOptional()
  @IsString()
  @Length(0, 500, { message: 'Status reason must be less than 500 characters' })
  statusReason?: string;

  @ApiProperty({ description: 'Admin notes', example: 'Updated by admin', required: false })
  @IsOptional()
  @IsString()
  adminNotes?: string;
}

export class RefundResponseDto {
  @ApiProperty({ description: 'Refund ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ description: 'Stripe refund ID', example: 're_1234567890abcdef' })
  refundId: string;

  @ApiProperty({ description: 'Transaction ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  transactionId: string;

  @ApiProperty({ description: 'Booking ID (if applicable)', example: '123e4567-e89b-12d3-a456-426614174000', required: false })
  bookingId?: string;

  @ApiProperty({ description: 'Original transaction amount', example: 100.00 })
  originalAmount: number;

  @ApiProperty({ description: 'Refund amount', example: 50.00 })
  refundAmount: number;

  @ApiProperty({ description: 'Currency', example: 'gbp' })
  currency: string;

  @ApiProperty({ description: 'Refund status', enum: RefundStatus, example: RefundStatus.COMPLETED })
  status: RefundStatus;

  @ApiProperty({ description: 'Refund reason', enum: RefundReason, example: RefundReason.CUSTOMER_REQUEST })
  reason: RefundReason;

  @ApiProperty({ description: 'Detailed reason', example: 'Customer requested refund due to service issues', required: false })
  reasonDetails?: string;

  @ApiProperty({ description: 'Admin notes', example: 'Approved by supervisor', required: false })
  adminNotes?: string;

  @ApiProperty({ description: 'Processed by admin user ID', example: '123e4567-e89b-12d3-a456-426614174000', required: false })
  processedBy?: string;

  @ApiProperty({ description: 'Processing timestamp', example: '2024-01-01T12:00:00Z', required: false })
  processedAt?: string;

  @ApiProperty({ description: 'Failure reason (if applicable)', example: 'Stripe API error', required: false })
  failureReason?: string;

  @ApiProperty({ description: 'Wallet balance updated', example: true })
  walletBalanceUpdated: boolean;

  @ApiProperty({ description: 'Notification sent to user', example: true })
  notificationSent: boolean;

  @ApiProperty({ description: 'Creation timestamp', example: '2024-01-01T12:00:00Z' })
  createdAt: string;

  @ApiProperty({ description: 'Last update timestamp', example: '2024-01-01T12:00:00Z' })
  updatedAt: string;
}

export class RefundListResponseDto {
  @ApiProperty({ description: 'List of refunds', type: [RefundResponseDto] })
  refunds: RefundResponseDto[];

  @ApiProperty({ description: 'Total count', example: 100 })
  total: number;

  @ApiProperty({ description: 'Current page', example: 1 })
  page: number;

  @ApiProperty({ description: 'Items per page', example: 20 })
  limit: number;

  @ApiProperty({ description: 'Total pages', example: 5 })
  totalPages: number;
}

export class RefundStatsDto {
  @ApiProperty({ description: 'Total refunds count', example: 150 })
  totalRefunds: number;

  @ApiProperty({ description: 'Total refund amount', example: 5000.00 })
  totalRefundAmount: number;

  @ApiProperty({ description: 'Average refund amount', example: 33.33 })
  averageRefundAmount: number;

  @ApiProperty({ description: 'Refunds by status', type: Object })
  refundsByStatus: Record<string, number>;

  @ApiProperty({ description: 'Refunds by reason', type: Object })
  refundsByReason: Record<string, number>;

  @ApiProperty({ description: 'Refunds this month', example: 25 })
  refundsThisMonth: number;

  @ApiProperty({ description: 'Amount refunded this month', example: 1250.00 })
  amountThisMonth: number;
}

export class BulkRefundDto {
  @ApiProperty({ description: 'Transaction IDs to refund', type: [String] })
  @IsUUID('4', { each: true })
  transactionIds: string[];

  @ApiProperty({ description: 'Refund reason', enum: RefundReason, example: RefundReason.CUSTOMER_REQUEST })
  @IsEnum(RefundReason)
  reason: RefundReason;

  @ApiProperty({ description: 'Detailed explanation', example: 'Bulk refund for service issues', required: false })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  reasonDetails?: string;

  @ApiProperty({ description: 'Admin notes', example: 'Approved by supervisor', required: false })
  @IsOptional()
  @IsString()
  adminNotes?: string;
}