import { PartialType, ApiProperty } from '@nestjs/swagger';
import { CreateNewsDto } from './create-news.dto';
import { IsOptional, IsBoolean, IsArray, IsString } from 'class-validator';

export class UpdateNewsDto extends PartialType(CreateNewsDto) {
  @ApiProperty({
    description: 'Image files to upload',
    type: 'array',
    items: {
      type: 'string',
      format: 'binary',
    },
    required: false,
  })
  files?: any[];

  @ApiProperty({
    description:
      'Whether to replace the main image with the first uploaded file',
    type: 'boolean',
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  replaceMainImage?: boolean;

  @ApiProperty({
    description: 'Additional image URLs for the news',
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  additionalImages?: string[];
  
  @ApiProperty({
    description: 'The category name of the news',
    required: false,
  })
  @IsOptional()
  @IsString()
  category?: string;
}
