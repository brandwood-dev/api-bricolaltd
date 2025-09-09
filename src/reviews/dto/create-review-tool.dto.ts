import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsUUID,
  IsInt,
  Min,
  Max,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateReviewToolDto {
  @ApiProperty({
    description: 'The ID of the user creating the review',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  @IsUUID()
  reviewerId: string;

  @ApiProperty({
    description: 'The ID of the user being reviewed',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsNotEmpty()
  @IsUUID()
  revieweeId: string;

  @ApiProperty({
    description: 'The ID of the tool being reviewed',
    example: '123e4567-e89b-12d3-a456-426614174002',
  })
  @IsNotEmpty()
  @IsUUID()
  toolId: string;

  @ApiProperty({
    description: 'The ID of the booking associated with the review',
    example: '123e4567-e89b-12d3-a456-426614174003',
  })
  @IsNotEmpty()
  @IsUUID()
  bookingId: string;

  @ApiProperty({
    description: 'The rating of the review (1-5)',
    example: 4,
    minimum: 1,
    maximum: 5,
  })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({
    description: 'The comment of the review',
    example: 'Great tool, worked perfectly for my project!',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(3)
  comment: string;
}
