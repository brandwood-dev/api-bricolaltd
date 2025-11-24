import {
  IsOptional,
  IsString,
  IsNumber,
  IsEnum,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum BookingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  ACCEPTED = 'ACCEPTED',
  ONGOING = 'ONGOING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  REJECTED = 'REJECTED',
  RETURNED = 'RETURNED',
  DISPUTE = 'DISPUTE',
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export enum SortField {
  CREATED_AT = 'createdAt',
  START_DATE = 'startDate',
  END_DATE = 'endDate',
  STATUS = 'status',
  TOTAL_AMOUNT = 'totalAmount',
}

export class AdminBookingQueryDto {
  @ApiPropertyOptional({
    description: 'Page number (starts from 1)',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    minimum: 1,
    maximum: 100,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({
    description:
      'Search term for booking ID, renter name, tool title, or owner name',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by booking status',
    enum: BookingStatus,
  })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @ApiPropertyOptional({ description: 'Filter by start date (ISO string)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Filter by end date (ISO string)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Filter by renter ID' })
  @IsOptional()
  @IsString()
  renterId?: string;

  @ApiPropertyOptional({ description: 'Filter by owner ID' })
  @IsOptional()
  @IsString()
  ownerId?: string;

  @ApiPropertyOptional({ description: 'Filter by tool ID' })
  @IsOptional()
  @IsString()
  toolId?: string;

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: SortField,
    default: SortField.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(SortField)
  sortBy?: SortField = SortField.CREATED_AT;

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: SortOrder,
    default: SortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;

  @ApiPropertyOptional({ description: 'Filter by minimum total amount' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minAmount?: number;

  @ApiPropertyOptional({ description: 'Filter by maximum total amount' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxAmount?: number;
}

export class AdminBookingResponseDto {
  @ApiPropertyOptional({ description: 'Array of bookings' })
  data: any[];

  @ApiPropertyOptional({ description: 'Total number of bookings' })
  total: number;

  @ApiPropertyOptional({ description: 'Current page number' })
  page: number;

  @ApiPropertyOptional({ description: 'Number of items per page' })
  limit: number;

  @ApiPropertyOptional({ description: 'Total number of pages' })
  totalPages: number;

  @ApiPropertyOptional({ description: 'Whether there is a next page' })
  hasNext: boolean;

  @ApiPropertyOptional({ description: 'Whether there is a previous page' })
  hasPrev: boolean;
}
