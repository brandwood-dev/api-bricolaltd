import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsBoolean,
  IsOptional,
  IsArray,
  IsEnum,
  IsUrl,
} from 'class-validator';
import { PaymentMethod } from '../enums/payment-method.enum';

export class CreatePaymentProviderDto {
  @ApiProperty({
    description: 'The unique name of the payment provider',
    example: 'stripe',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    description: 'The display name of the payment provider',
    example: 'Stripe',
  })
  @IsNotEmpty()
  @IsString()
  displayName: string;

  @ApiProperty({
    description: 'Description of the payment provider',
    example: 'Online payment processing platform',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Whether the payment provider is active',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;

  @ApiProperty({
    description: 'API key for the payment provider',
    example: 'pk_test_...',
    required: false,
  })
  @IsOptional()
  @IsString()
  apiKey?: string;

  @ApiProperty({
    description: 'API secret for the payment provider',
    example: 'sk_test_...',
    required: false,
  })
  @IsOptional()
  @IsString()
  apiSecret?: string;

  @ApiProperty({
    description: 'Webhook URL for the payment provider',
    example: 'https://api.example.com/webhooks/stripe',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  webhookUrl?: string;

  @ApiProperty({
    description: 'Logo URL for the payment provider',
    example: 'https://example.com/stripe-logo.png',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @ApiProperty({
    description: 'Configuration object for the payment provider',
    example: { environment: 'sandbox', currency: 'EUR' },
    required: false,
  })
  @IsOptional()
  config?: Record<string, any>;

  @ApiProperty({
    description: 'Supported payment methods',
    enum: PaymentMethod,
    isArray: true,
    example: [PaymentMethod.CARD, PaymentMethod.STRIPE],
  })
  @IsNotEmpty()
  @IsArray()
  @IsEnum(PaymentMethod, { each: true })
  supportedMethods: PaymentMethod[];
}
