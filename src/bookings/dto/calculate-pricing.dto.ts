import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID, IsString, Matches } from 'class-validator';

export class CalculatePricingDto {
  @ApiProperty({ description: 'The ID of the tool being booked' })
  @IsNotEmpty()
  @IsUUID()
  toolId: string;

  @ApiProperty({
    description: 'The start date of the booking',
    example: '2025-01-01',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'startDate must be in YYYY-MM-DD format',
  })
  startDate: string;

  @ApiProperty({
    description: 'The end date of the booking',
    example: '2025-01-03',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'endDate must be in YYYY-MM-DD format',
  })
  endDate: string;
}

export class PricingResponseDto {
  @ApiProperty({ description: 'Base price per day' })
  basePrice: number;

  @ApiProperty({ description: 'Number of days' })
  totalDays: number;

  @ApiProperty({ description: 'Subtotal (basePrice * totalDays)' })
  subtotal: number;

  @ApiProperty({ description: 'Platform fees' })
  fees: number;

  @ApiProperty({ description: 'Security deposit' })
  deposit: number;

  @ApiProperty({ description: 'Total amount to pay' })
  totalAmount: number;
}
