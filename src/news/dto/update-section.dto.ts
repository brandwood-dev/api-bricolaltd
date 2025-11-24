import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  CreateParagraphDto,
  CreateSectionImageDto,
} from './create-section.dto';

export class UpdateSectionDto {
  @ApiProperty({ description: 'The title of the section', required: false })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({
    description: 'The order position of the section',
    required: false,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  orderIndex?: number;

  @ApiProperty({
    description: 'The paragraphs in this section',
    type: [CreateParagraphDto],
    required: false,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateParagraphDto)
  @IsOptional()
  paragraphs?: CreateParagraphDto[];

  @ApiProperty({
    description: 'The images in this section',
    type: [CreateSectionImageDto],
    required: false,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSectionImageDto)
  @IsOptional()
  images?: CreateSectionImageDto[];
}
