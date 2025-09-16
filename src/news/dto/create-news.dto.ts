import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsBoolean,
  IsUrl,
  IsArray,
} from 'class-validator';

export class CreateNewsDto {
  @ApiProperty({
    description: 'The title of the news article',
    example: 'New Tools Available for Rent',
  })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({
    description: 'The content of the news article',
    example:
      'We are excited to announce that we have added 20 new tools to our rental inventory...',
  })
  @IsNotEmpty()
  @IsString()
  content: string;

  @ApiProperty({
    description: 'URL to the main image for the news article',
    example: 'https://example.com/images/news-image.jpg',
    required: false,
  })
  @IsOptional()
  @IsUrl({ require_tld: false }, { message: 'imageUrl must be a valid URL' })
  imageUrl?: string;

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
    description: 'Whether this news article is public',
    example: true,
    default: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiProperty({
    description: 'Whether this news article is featured on the homepage',
    example: false,
    default: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiProperty({
    description: 'Brief summary of the news article',
    example:
      'Expanding our tool inventory with 20 new professional-grade tools',
    required: false,
  })
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiProperty({
    description: 'Category ID for the news article',
    example: 'category-uuid',
    required: false,
  })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ description: 'The category name of the news', required: false })
  category?: string;
}
