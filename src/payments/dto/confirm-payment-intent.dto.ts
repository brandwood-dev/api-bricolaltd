import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ConfirmPaymentIntentDto {
  @ApiProperty({
    description: 'ID de la méthode de paiement Stripe',
    example: 'pm_1234567890abcdef',
  })
  @IsString()
  paymentMethodId: string;
}
