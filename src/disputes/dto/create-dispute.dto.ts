import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID, IsString, IsOptional, IsArray } from 'class-validator';

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
    description: 'The description of the dispute',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'The specific reason for reporting the dispute' })
  @IsNotEmpty()
  @IsString()
  reportReason: string;

  @ApiProperty({ description: 'The detailed message explaining the dispute' })
  @IsNotEmpty()
  @IsString()
  reportMessage: string;

  @ApiProperty({
    description: 'Array of image URLs uploaded for the dispute',
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];
}
