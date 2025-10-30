import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ConfirmDepositSetupDto {
  @ApiProperty({
    description: 'ID du SetupIntent Stripe confirmé',
    example: 'seti_1234567890abcdef',
  })
  @IsString()
  @IsNotEmpty()
  setupIntentId: string;
}