import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateParagraphDto {
  @ApiProperty({ description: 'The content of the paragraph' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({ description: 'The order position of the paragraph' })
  @IsInt()
  @Min(0)
  orderIndex: number;
}

export class CreateSectionImageDto {
  @ApiProperty({ description: 'The URL of the image' })
  @IsString()
  @IsNotEmpty()
  url: string;

  @ApiProperty({ description: 'The alt text for the image', required: false })
  @IsString()
  @IsOptional()
  alt?: string;

  @ApiProperty({ description: 'The order position of the image' })
  @IsInt()
  @Min(0)
  orderIndex: number;
}

export class CreateSectionDto {
  @ApiProperty({
    description: 'The ID of the news article this section belongs to',
  })
  @IsString()
  @IsNotEmpty()
  newsId: string;

  @ApiProperty({ description: 'The title of the section' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'The order position of the section' })
  @IsInt()
  @Min(0)
  orderIndex: number;

  @ApiProperty({
    description: 'The paragraphs in this section',
    type: [CreateParagraphDto],
    required: false,
  })
  @ValidateNested({ each: true })
  @Type(() => CreateParagraphDto)
  @IsOptional()
  paragraphs?: CreateParagraphDto[];

  @ApiProperty({
    description: 'The images in this section',
    type: [CreateSectionImageDto],
    required: false,
  })
  @ValidateNested({ each: true })
  @Type(() => CreateSectionImageDto)
  @IsOptional()
  images?: CreateSectionImageDto[];
}
