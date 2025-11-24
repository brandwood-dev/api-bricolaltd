import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsUUID,
  IsNumber,
  Min,
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
} from 'class-validator';
import { PaymentMethod } from '../enums/payment-method.enum';

export class CreatePaymentTransactionDto {
  @ApiProperty({
    description: 'The ID of the associated transaction',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  @IsUUID()
  transactionId: string;

  @ApiProperty({
    description: 'The payment method used',
    enum: PaymentMethod,
    example: PaymentMethod.CARD,
  })
  @IsNotEmpty()
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiProperty({
    description: 'The ID of the payment provider',
    example: 1,
  })
  @IsNotEmpty()
  @IsInt()
  providerId: number;

  @ApiProperty({
    description: 'The amount of the payment transaction',
    example: 100.5,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({
    description: 'The currency code',
    example: 'EUR',
    default: 'EUR',
  })
  @IsOptional()
  @IsString()
  currency?: string = 'EUR';

  @ApiProperty({
    description: 'The status of the payment transaction',
    example: 'pending',
    default: 'pending',
  })
  @IsOptional()
  @IsString()
  status?: string = 'pending';

  @ApiProperty({
    description: 'Provider transaction ID',
    example: 'pi_1234567890',
    required: false,
  })
  @IsOptional()
  @IsString()
  providerTransactionId?: string;

  @ApiProperty({
    description: 'Provider status',
    example: 'succeeded',
    required: false,
  })
  @IsOptional()
  @IsString()
  providerStatus?: string;

  @ApiProperty({
    description: 'Error code if payment failed',
    example: 'card_declined',
    required: false,
  })
  @IsOptional()
  @IsString()
  errorCode?: string;

  @ApiProperty({
    description: 'Error message if payment failed',
    example: 'Your card was declined.',
    required: false,
  })
  @IsOptional()
  @IsString()
  errorMessage?: string;

  @ApiProperty({
    description: 'Additional metadata for the payment transaction',
    example: { customerIp: '192.168.1.1', userAgent: 'Mozilla/5.0...' },
    required: false,
  })
  @IsOptional()
  metadata?: Record<string, any>;
}
