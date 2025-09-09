import {
  Controller,
  Get,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AdminAnalyticsService } from './admin-analytics.service';

@ApiTags('admin-analytics')
@Controller('admin/analytics')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminAnalyticsController {
  constructor(private readonly adminAnalyticsService: AdminAnalyticsService) {}

  @Get('revenue')
  @ApiOperation({ summary: 'Get detailed revenue analytics' })
  @ApiResponse({ status: 200, description: 'Revenue analytics data' })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d', '1y'] })
  @ApiQuery({ name: 'granularity', required: false, enum: ['day', 'week', 'month'] })
  async getRevenueAnalytics(
    @Query('period') period: string = '30d',
    @Query('granularity') granularity: string = 'day',
  ) {
    return this.adminAnalyticsService.getRevenueAnalytics(period, granularity);
  }

  @Get('users')
  @ApiOperation({ summary: 'Get detailed user analytics' })
  @ApiResponse({ status: 200, description: 'User analytics data' })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d', '1y'] })
  async getUserAnalytics(@Query('period') period: string = '30d') {
    return this.adminAnalyticsService.getUserAnalytics(period);
  }

  @Get('tools')
  @ApiOperation({ summary: 'Get tool performance analytics' })
  @ApiResponse({ status: 200, description: 'Tool analytics data' })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d', '1y'] })
  async getToolAnalytics(@Query('period') period: string = '30d') {
    return this.adminAnalyticsService.getToolAnalytics(period);
  }

  @Get('bookings')
  @ApiOperation({ summary: 'Get booking analytics' })
  @ApiResponse({ status: 200, description: 'Booking analytics data' })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d', '1y'] })
  async getBookingAnalytics(@Query('period') period: string = '30d') {
    return this.adminAnalyticsService.getBookingAnalytics(period);
  }

  @Get('geographic')
  @ApiOperation({ summary: 'Get geographic analytics' })
  @ApiResponse({ status: 200, description: 'Geographic analytics data' })
  async getGeographicAnalytics() {
    return this.adminAnalyticsService.getGeographicAnalytics();
  }

  @Get('performance')
  @ApiOperation({ summary: 'Get platform performance metrics' })
  @ApiResponse({ status: 200, description: 'Performance metrics data' })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d', '1y'] })
  async getPerformanceMetrics(@Query('period') period: string = '30d') {
    return this.adminAnalyticsService.getPerformanceMetrics(period);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export analytics data' })
  @ApiResponse({ status: 200, description: 'Exported analytics data' })
  @ApiQuery({ name: 'type', required: true, enum: ['revenue', 'users', 'tools', 'bookings'] })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d', '1y'] })
  @ApiQuery({ name: 'format', required: false, enum: ['csv', 'json', 'xlsx'] })
  async exportAnalytics(
    @Query('type') type: string,
    @Query('period') period: string = '30d',
    @Query('format') format: string = 'csv',
  ) {
    return this.adminAnalyticsService.exportAnalytics(type, period, format);
  }

  @Get('formatted')
  @ApiOperation({ summary: 'Get formatted analytics data for frontend' })
  @ApiResponse({ status: 200, description: 'Formatted analytics data matching frontend interface' })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d', '1y'] })
  async getFormattedAnalyticsData(@Query('period') period: string = '30d') {
    return this.adminAnalyticsService.getFormattedAnalyticsData(period);
  }
}