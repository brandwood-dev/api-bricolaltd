import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsDateString } from 'class-validator';

export class BookingStatsQueryDto {
  @ApiProperty({
    description: 'Start date for stats calculation',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({
    description: 'End date for stats calculation',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class BookingStatsResponseDto {
  @ApiProperty({ description: 'Total number of bookings' })
  totalBookings: number;

  @ApiProperty({ description: 'Number of pending bookings' })
  pendingBookings: number;

  @ApiProperty({ description: 'Number of accepted bookings' })
  acceptedBookings: number;

  @ApiProperty({ description: 'Number of ongoing bookings' })
  ongoingBookings: number;

  @ApiProperty({ description: 'Number of completed bookings' })
  completedBookings: number;

  @ApiProperty({ description: 'Number of cancelled bookings' })
  cancelledBookings: number;

  @ApiProperty({ description: 'Number of rejected bookings' })
  rejectedBookings: number;

  @ApiProperty({ description: 'Total revenue from completed bookings' })
  totalRevenue: number;

  @ApiProperty({ description: 'Average booking value' })
  averageBookingValue: number;

  @ApiProperty({ description: 'Most popular tools', type: [Object] })
  popularTools: Array<{
    toolId: string;
    toolTitle: string;
    bookingCount: number;
  }>;

  @ApiProperty({ description: 'Booking trends by status', type: [Object] })
  statusBreakdown: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
}
