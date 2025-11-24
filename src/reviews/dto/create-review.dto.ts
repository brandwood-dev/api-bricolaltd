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

export class CreateReviewDto {
  @ApiProperty({
    description: 'The ID of the user creating the review',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  @IsUUID()
  userId: string;

  @ApiProperty({
    description: 'The ID of the booking being reviewed',
    example: '123e4567-e89b-12d3-a456-426614174001',
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
    example: 'Great service! The tool was in excellent condition.',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(3)
  comment: string;
}
