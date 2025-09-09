import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsString, IsUUID } from 'class-validator';

export class ToolPhotoDto {
  @ApiProperty({
    description: 'The unique identifier of the tool photo',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  id: string;

  @ApiProperty({
    description: 'The URL of the photo',
    example: 'https://example-bucket.s3.amazonaws.com/tools/image.jpg',
  })
  @IsString()
  url: string;

  @ApiProperty({
    description: 'The filename of the photo',
    example: 'image.jpg',
  })
  @IsString()
  filename: string;

  @ApiProperty({
    description: 'Whether this is the primary photo',
    default: false,
  })
  @IsBoolean()
  isPrimary: boolean;

  @ApiProperty({
    description: 'The ID of the tool this photo belongs to',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  toolId: string;

  @ApiProperty({
    description: 'The date when the photo was created',
  })
  createdAt: Date;
}
