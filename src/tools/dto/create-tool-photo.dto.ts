import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class CreateToolPhotoDto {
  @ApiProperty({
    description: 'The ID of the tool this photo belongs to',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  toolId: string;

  @ApiProperty({
    description: 'Whether this is the primary photo',
    default: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
