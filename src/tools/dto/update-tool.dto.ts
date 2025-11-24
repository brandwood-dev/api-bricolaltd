import { PartialType } from '@nestjs/swagger';
import { CreateToolDto } from './create-tool.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class UpdateToolDto extends PartialType(CreateToolDto) {
  // Override categoryId and subcategoryId to make them optional for updates
  @ApiProperty({
    description: 'The ID of the category',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiProperty({
    description: 'The ID of the subcategory',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  subcategoryId?: string;
}
