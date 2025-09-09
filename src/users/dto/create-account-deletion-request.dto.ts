import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAccountDeletionRequestDto {
  @ApiProperty({
    description: 'Reason for account deletion request',
    example: 'No longer need the service',
    required: false,
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}