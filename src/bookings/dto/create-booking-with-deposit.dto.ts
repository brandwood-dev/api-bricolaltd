import { IsString, IsNotEmpty, IsNumber, IsDateString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBookingWithDepositDto {
  @ApiProperty({
    description: 'ID du locataire',
    example: 'b7baf92e-8105-4fb7-9ab5-b57b1532dc6d',
  })
  @IsString()
  @IsNotEmpty()
  renterId: string;

  @ApiProperty({
    description: 'ID de l\'outil à louer',
    example: '0a91d8ae-96e7-42be-bf1b-10186be9381a',
  })
  @IsString()
  @IsNotEmpty()
  toolId: string;

  @ApiProperty({
    description: 'Date de début de location (YYYY-MM-DD)',
    example: '2025-01-30',
  })
  @IsDateString()
  startDate: string;

  @ApiProperty({
    description: 'Date de fin de location (YYYY-MM-DD)',
    example: '2025-02-02',
  })
  @IsDateString()
  endDate: string;

  @ApiProperty({
    description: 'Message optionnel du locataire',
    example: 'Test de réservation avec caution automatique',
    required: false,
  })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiProperty({
    description: 'Méthode de paiement',
    example: 'card',
    enum: ['card', 'bank_transfer'],
  })
  @IsEnum(['card', 'bank_transfer'])
  paymentMethod: string;

  @ApiProperty({
    description: 'Prix total de la location',
    example: 150.00,
  })
  @IsNumber()
  totalPrice: number;

  @ApiProperty({
    description: 'Heure de récupération (HH:MM)',
    example: '10:00',
  })
  @IsString()
  @IsNotEmpty()
  pickupHour: string;
}