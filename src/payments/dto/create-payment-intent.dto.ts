import { IsNumber, IsString, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePaymentIntentDto {
  @ApiProperty({
    description: 'Montant à bloquer (en unité principale de la devise)',
    example: 50.00,
    minimum: 0.01
  })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({
    description: 'Code de devise (ISO 4217)',
    example: 'gbp',
    default: 'gbp'
  })
  @IsString()
  @IsOptional()
  currency?: string = 'gbp';

  @ApiProperty({
    description: 'ID de la réservation associée',
    example: 'booking_123456789'
  })
  @IsString()
  bookingId: string;

  @ApiProperty({
    description: 'Métadonnées supplémentaires',
    required: false
  })
  @IsOptional()
  metadata?: Record<string, any>;
}