import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelBookingDto {
  @ApiProperty({
    description: 'Reason for cancellation',
    example: 'Changement de plans',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiProperty({
    description: 'Who is cancelling the booking',
    example: 'renter',
    enum: ['renter', 'owner'],
    required: false,
    default: 'renter',
  })
  @IsOptional()
  @IsString()
  cancelledBy?: 'renter' | 'owner';
}