import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID, IsString, IsOptional } from 'class-validator';

export class CreateDisputeDto {
  @ApiProperty({ description: 'The ID of the user who created the dispute' })
  @IsNotEmpty()
  @IsUUID()
  userId: string;

  @ApiProperty({ description: 'The ID of the booking related to the dispute' })
  @IsNotEmpty()
  @IsUUID()
  bookingId: string;

  @ApiProperty({ description: 'The reason for the dispute' })
  @IsNotEmpty()
  @IsString()
  reason: string;

  @ApiProperty({
    description: 'Additional details about the dispute',
    required: false,
  })
  @IsOptional()
  @IsString()
  details?: string;
}
