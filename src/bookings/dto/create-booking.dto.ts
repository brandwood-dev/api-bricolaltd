import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID, IsDateString, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateBookingDto {
  @ApiProperty({ description: 'The ID of the user making the booking' })
  @IsNotEmpty()
  @IsUUID()
  renterId: string;

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

  @ApiProperty({ description: 'Additional notes for the booking', required: false })
  @IsOptional()
  notes?: string;
}