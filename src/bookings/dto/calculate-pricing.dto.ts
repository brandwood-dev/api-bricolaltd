import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID, IsDateString } from 'class-validator';

export class CalculatePricingDto {
  @ApiProperty({ description: 'The ID of the tool being booked' })
  @IsNotEmpty()
  @IsUUID()
  toolId: string;

  @ApiProperty({ description: 'The start date of the booking', example: '2023-01-01T10:00:00Z' })
  @IsNotEmpty()
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'The end date of the booking', example: '2023-01-03T18:00:00Z' })
  @IsNotEmpty()
  @IsDateString()
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