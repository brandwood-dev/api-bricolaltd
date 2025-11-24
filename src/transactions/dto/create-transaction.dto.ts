import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsUUID,
  IsNumber,
  Min,
  IsString,
  IsOptional,
  IsEnum,
} from 'class-validator';

export enum TransactionType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
  TRANSFER = 'TRANSFER',
  PAYMENT = 'PAYMENT',
  REFUND = 'REFUND',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  VOIDED = 'VOIDED',
}

export class CreateTransactionDto {
  @ApiProperty({
    description: 'The ID of the wallet associated with this transaction',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  @IsUUID()
  walletId: string;

  @ApiProperty({
    description: 'The ID of the recipient wallet (for transfers only)',
    example: '123e4567-e89b-12d3-a456-426614174001',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  recipientWalletId?: string;

  @ApiProperty({
    description: 'The amount of the transaction',
    example: 100.5,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({
    description: 'The type of transaction',
    enum: TransactionType,
    example: TransactionType.DEPOSIT,
  })
  @IsNotEmpty()
  @IsEnum(TransactionType)
  type: string;

  @ApiProperty({
    description: 'The status of the transaction',
    enum: TransactionStatus,
    example: TransactionStatus.PENDING,
    default: TransactionStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: string = TransactionStatus.PENDING;

  @ApiProperty({
    description: 'Description of the transaction',
    example: 'Monthly subscription payment',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Reference code for the transaction',
    example: 'INV-2023-001',
    required: false,
  })
  @IsOptional()
  @IsString()
  reference?: string;
}
