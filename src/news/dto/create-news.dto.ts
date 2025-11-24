import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsBoolean,
  IsUrl,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateSectionDto } from './create-section.dto';

export class CreateNewsDto {
  @ApiProperty({
    description: 'The title of the news article',
    example: 'New Tools Available for Rent',
  })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({
    description: 'The content of the news article (legacy field)',
    example:
      'We are excited to announce that we have added 20 new tools to our rental inventory...',
    required: false,
  })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiProperty({
    description: 'Sections of the article with structured content',
    type: [CreateSectionDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSectionDto)
  sections?: CreateSectionDto[];

  @ApiProperty({
    description: 'URL to the main image for the news article',
    example: 'https://example.com/images/news-image.jpg',
    required: false,
  })
  @IsOptional()
  @IsUrl({ require_tld: false }, { message: 'imageUrl must be a valid URL' })
  imageUrl?: string;

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
    description: 'The category name of the news',
    required: false,
  })
  @IsOptional()
  @IsString()
  category?: string;

  // Pour le traitement des images inline
  @ApiProperty({
    description: 'Whether to replace the main image',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  replaceMainImage?: boolean;
}
