import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID, IsNumber, Min } from 'class-validator';

export class CreateWalletDto {
  @ApiProperty({
    description: 'The ID of the user who owns this wallet',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  @IsUUID()
  userId: string;

  @ApiProperty({
    description: 'The initial balance of the wallet',
    example: 0,
    default: 0,
  })
  @IsNumber()
  @Min(0)
  balance: number = 0;
}