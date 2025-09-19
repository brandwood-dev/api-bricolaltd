import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { BookingsService } from '../bookings/bookings.service';
import { BookingStatsQueryDto } from '../bookings/dto/booking-stats.dto';

@ApiTags('admin-bookings')
@Controller('admin/bookings')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminBookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get booking statistics for admin dashboard' })
  @ApiResponse({ status: 200, description: 'Booking statistics retrieved successfully.' })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d', '1y'] })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async getBookingStats(@Query() queryDto?: BookingStatsQueryDto) {
    try {
      const stats = await this.bookingsService.getBookingStats(queryDto);
      return {
        data: stats,
        message: 'Request successful'
      };
    } catch (error) {
      throw error;
    }
  }
}