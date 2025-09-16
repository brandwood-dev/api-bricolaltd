import { PartialType } from '@nestjs/swagger';
import { CreateBookingDto } from './create-booking.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsBoolean, IsString } from 'class-validator';
import { BookingStatus } from '../enums/booking-status.enum';

export class UpdateBookingDto extends PartialType(CreateBookingDto) {
  @ApiProperty({
    description: 'The status of the booking',
    enum: BookingStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @ApiProperty({
    description: 'The total price of the booking',
    required: false,
  })
  @IsOptional()
  totalPrice?: number;

  @ApiProperty({
    description: 'Whether the booking has an active claim/dispute',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  hasActiveClaim?: boolean;

  @ApiProperty({
    description: 'The reason for refusal',
    required: false,
  })
  @IsOptional()
  @IsString()
  refusalReason?: string;

  @ApiProperty({
    description: 'The message for refusal',
    required: false,
  })
  @IsOptional()
  @IsString()
  refusalMessage?: string;

  @ApiProperty({
    description: 'Whether the tool has been picked up by the owner',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  pickupTool?: boolean;
}
