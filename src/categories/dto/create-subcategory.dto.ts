import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsUUID } from 'class-validator';

export class CreateSubcategoryDto {
  @ApiProperty({
    description: 'The name of the subcategory',
    example: 'drills',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    description: 'The display name of the subcategory',
    example: 'Drills',
  })
  @IsNotEmpty()
  @IsString()
  displayName: string;

  @ApiProperty({
    description: 'The description of the subcategory',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'The ID of the parent category' })
  @IsNotEmpty()
  @IsUUID()
  categoryId: string;
}
