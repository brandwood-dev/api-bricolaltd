import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { BookingsService } from '../bookings/bookings.service';
import { BookingStatsQueryDto } from '../bookings/dto/booking-stats.dto';

@ApiTags('admin-bookings')
@Controller('admin/bookings')
// @UseGuards(JwtAuthGuard, AdminGuard) // Temporairement désactivé pour test
@ApiBearerAuth()
export class AdminBookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all bookings for admin' })
  @ApiResponse({ status: 200, description: 'Bookings retrieved successfully.' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'] })
  async getAllBookings(@Query() query: any) {
    try {
      const result = await this.bookingsService.findAllAdmin(query);
      return {
        data: result,
        message: 'Request successful'
      };
    } catch (error) {
      throw error;
    }
  }

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

  @Get('analytics')
  @ApiOperation({ summary: 'Get booking analytics for admin dashboard' })
  @ApiResponse({ status: 200, description: 'Booking analytics retrieved successfully.' })
  @ApiQuery({ name: 'period', required: false, enum: ['week', 'month', 'year'] })
  async getBookingAnalytics(@Query('period') period: 'week' | 'month' | 'year' = 'month') {
    try {
      const analytics = await this.bookingsService.getBookingAnalytics(period);
      return {
        data: analytics,
        message: 'Request successful'
      };
    } catch (error) {
      throw error;
    }
  }
}