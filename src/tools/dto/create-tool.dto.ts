import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsUUID,
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  Min,
} from 'class-validator';
import { ToolCondition } from '../enums/tool-condition.enum';
import { ToolStatus } from '../enums/tool-status.enum';
import { AvailabilityStatus } from '../enums/availability-status.enum';

export class CreateToolDto {
  @ApiProperty({
    description: 'Index of the primary photo (0-based)',
    example: 0,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  primaryPhotoIndex?: number;

  @ApiProperty({
    description: 'The title of the tool',
    example: 'Professional Hammer',
  })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({
    description: 'The description of the tool',
    example: 'Professional grade electric drill with variable speed control',
  })
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiProperty({
    description: 'The base price of the tool',
    example: 25.99,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  basePrice: number;

  @ApiProperty({
    description: 'The deposit amount for the tool',
    example: 100.0,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  depositAmount: number;

  @ApiProperty({
    description: 'The brand of the tool',
    example: 'DeWalt',
    required: false,
  })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiProperty({
    description: 'The model of the tool',
    example: 'DW123',
    required: false,
  })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiProperty({
    description: 'The year of the tool',
    example: 2022,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  year?: number;

  @ApiProperty({
    description: 'The condition of the tool',
    enum: ToolCondition,
    example: ToolCondition.GOOD,
  })
  @IsNotEmpty()
  @IsEnum(ToolCondition)
  condition: ToolCondition;

  @ApiProperty({
    description: 'The pickup address for the tool',
  })
  @IsNotEmpty()
  @IsString()
  pickupAddress: string;

  @ApiProperty({
    description: 'The latitude of the pickup location',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiProperty({
    description: 'The longitude of the pickup location',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiProperty({
    description: 'Instructions from the owner',
    required: false,
  })
  @IsOptional()
  @IsString()
  ownerInstructions?: string;

  @ApiProperty({
    description: 'The publication status of the tool',
    enum: ToolStatus,
    default: ToolStatus.DRAFT,
  })
  @IsOptional()
  @IsEnum(ToolStatus)
  toolStatus?: ToolStatus;

  @ApiProperty({
    description: 'The availability status of the tool',
    enum: AvailabilityStatus,
    default: AvailabilityStatus.AVAILABLE,
  })
  @IsOptional()
  @IsEnum(AvailabilityStatus)
  availabilityStatus?: AvailabilityStatus;

  @ApiProperty({
    description: 'The ID of the category',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  @IsUUID()
  categoryId: string;

  @ApiProperty({
    description: 'The ID of the subcategory',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  @IsUUID()
  subcategoryId: string;

  @ApiProperty({
    description: 'The ID of the user who owns this tool',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  @IsUUID()
  ownerId: string;
}
