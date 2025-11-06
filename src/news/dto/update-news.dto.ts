import { PartialType, ApiProperty } from '@nestjs/swagger';
import { CreateNewsDto } from './create-news.dto';
import { IsOptional, IsBoolean, IsArray, IsString } from 'class-validator';

export class UpdateNewsDto extends PartialType(CreateNewsDto) {
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
    description: 'The category name of the news',
    required: false,
  })
  @IsOptional()
  @IsString()
  category?: string;
}
