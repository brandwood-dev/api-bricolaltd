import { IsString, IsOptional, IsNumber, IsEnum, IsObject, ValidateNested, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ThreeDSecureBillingDetailsDto {
  @ApiProperty({ description: 'Cardholder name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Email address' })
  @IsString()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'Phone number', required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ description: 'Billing address', required: false })
  @IsObject()
  @IsOptional()
  address?: {
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
  };
}

export class InitializeThreeDSecureDto {
  @ApiProperty({ description: 'Payment Intent ID' })
  @IsString()
  @IsNotEmpty()
  paymentIntentId: string;

  @ApiProperty({ description: 'Amount in major currency unit' })
  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @ApiProperty({ description: 'Currency code (gbp, eur, usd)', default: 'gbp' })
  @IsString()
  @IsOptional()
  currency?: string = 'gbp';

  @ApiProperty({ description: 'Billing details', required: false })
  @ValidateNested()
  @Type(() => ThreeDSecureBillingDetailsDto)
  @IsOptional()
  billingDetails?: ThreeDSecureBillingDetailsDto;

  @ApiProperty({ description: 'Device information', required: false })
  @IsObject()
  @IsOptional()
  deviceInfo?: {
    screenResolution?: string;
    timezone?: string;
    language?: string;
    colorDepth?: number;
    javaEnabled?: boolean;
    javascriptEnabled?: boolean;
    acceptHeaders?: string;
    userAgent?: string;
  };
}

export class CompleteThreeDSecureChallengeDto {
  @ApiProperty({ description: '3D Secure session ID' })
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @ApiProperty({ description: 'Payment Intent ID' })
  @IsString()
  @IsNotEmpty()
  paymentIntentId: string;

  @ApiProperty({ description: 'Redirect result from 3DS challenge', required: false })
  @IsString()
  @IsOptional()
  redirectResult?: string;

  @ApiProperty({ description: 'Challenge completion data', required: false })
  @IsObject()
  @IsOptional()
  challengeData?: {
    transStatus?: string;
    cavv?: string;
    eci?: string;
    dsTransId?: string;
    threeDSServerTransID?: string;
  };
}

export class ThreeDSecureResultDto {
  @ApiProperty({ description: 'Success status' })
  success: boolean;

  @ApiProperty({ description: 'Requires additional action (3DS challenge)' })
  requiresAction: boolean;

  @ApiProperty({ description: 'Client secret for Stripe SDK', required: false })
  @IsString()
  @IsOptional()
  clientSecret?: string;

  @ApiProperty({ description: 'Redirect URL for 3DS challenge', required: false })
  @IsString()
  @IsOptional()
  redirectUrl?: string;

  @ApiProperty({ description: 'Error message', required: false })
  @IsString()
  @IsOptional()
  error?: string;

  @ApiProperty({ description: 'Error code', required: false })
  @IsString()
  @IsOptional()
  errorCode?: string;

  @ApiProperty({ description: '3D Secure session ID', required: false })
  @IsString()
  @IsOptional()
  sessionId?: string;

  @ApiProperty({ description: '3D Secure status', required: false })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiProperty({ description: 'Authentication method', required: false })
  @IsString()
  @IsOptional()
  authenticationMethod?: string;

  @ApiProperty({ description: 'Authentication flow', required: false })
  @IsString()
  @IsOptional()
  authenticationFlow?: 'frictionless' | 'challenge';
}

export class ThreeDSecureStatsDto {
  @ApiProperty({ description: 'Time range for statistics', enum: ['24h', '7d', '30d'] })
  @IsEnum(['24h', '7d', '30d'])
  @IsOptional()
  timeRange?: '24h' | '7d' | '30d' = '24h';
}

export class ThreeDSecureStatsResultDto {
  @ApiProperty({ description: 'Total number of 3DS sessions' })
  totalSessions: number;

  @ApiProperty({ description: 'Success rate percentage' })
  successRate: number;

  @ApiProperty({ description: 'Challenge rate percentage' })
  challengeRate: number;

  @ApiProperty({ description: 'Frictionless rate percentage' })
  frictionlessRate: number;

  @ApiProperty({ description: 'Average processing time in milliseconds' })
  averageProcessingTime: number;

  @ApiProperty({ description: 'Breakdown by status' })
  byStatus: Record<string, number>;

  @ApiProperty({ description: 'Breakdown by currency' })
  byCurrency: Record<string, number>;

  @ApiProperty({ description: 'Breakdown by card brand' })
  byCardBrand: Record<string, number>;
}