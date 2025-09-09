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
import { EnhancedAdminGuard } from '../auth/guards/enhanced-admin.guard';
import { AdminPermissions } from '../auth/decorators/admin-permissions.decorator';
import { AdminDashboardService } from './admin-dashboard.service';

@ApiTags('admin-dashboard')
@Controller('admin/dashboard')
@UseGuards(EnhancedAdminGuard)
@ApiBearerAuth()
export class AdminDashboardController {
  constructor(private readonly adminDashboardService: AdminDashboardService) {}

  @Get()
  @AdminPermissions('view_dashboard')
  @ApiOperation({ summary: 'Get complete dashboard data' })
  @ApiResponse({ status: 200, description: 'Complete dashboard data' })
  @ApiQuery({ name: 'start_date', required: false, type: String })
  @ApiQuery({ name: 'end_date', required: false, type: String })
  async getDashboardData(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string
  ) {
    return this.adminDashboardService.getDashboardData(startDate, endDate);
  }

  @Get('overview')
  @AdminPermissions('view_dashboard')
  @ApiOperation({ summary: 'Get dashboard overview statistics' })
  @ApiResponse({ status: 200, description: 'Dashboard overview data' })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d', '1y'] })
  async getDashboardOverview(@Query('period') period: string = '30d') {
    return this.adminDashboardService.getDashboardOverview(period);
  }

  @Get('kpis')
  @ApiOperation({ summary: 'Get key performance indicators' })
  @ApiResponse({ status: 200, description: 'KPI data' })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d', '1y'] })
  async getKPIs(@Query('period') period: string = '30d') {
    return this.adminDashboardService.getKPIs(period);
  }

  @Get('recent-activities')
  @ApiOperation({ summary: 'Get recent platform activities' })
  @ApiResponse({ status: 200, description: 'Recent activities data' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getRecentActivities(@Query('limit') limit: number = 10) {
    return this.adminDashboardService.getRecentActivities(limit);
  }

  @Get('revenue-chart')
  @ApiOperation({ summary: 'Get revenue chart data' })
  @ApiResponse({ status: 200, description: 'Revenue chart data' })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d', '1y'] })
  async getRevenueChart(@Query('period') period: string = '30d') {
    return this.adminDashboardService.getRevenueChart(period);
  }

  @Get('user-growth')
  @ApiOperation({ summary: 'Get user growth data' })
  @ApiResponse({ status: 200, description: 'User growth data' })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d', '1y'] })
  async getUserGrowth(@Query('period') period: string = '30d') {
    return this.adminDashboardService.getUserGrowth(period);
  }

  @Get('booking-stats')
  @ApiOperation({ summary: 'Get booking statistics' })
  @ApiResponse({ status: 200, description: 'Booking statistics data' })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d', '1y'] })
  async getBookingStats(@Query('period') period: string = '30d') {
    return this.adminDashboardService.getBookingStats(period);
  }

  @Get('top-tools')
  @ApiOperation({ summary: 'Get top performing tools' })
  @ApiResponse({ status: 200, description: 'Top tools data' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getTopTools(@Query('limit') limit: number = 10) {
    return this.adminDashboardService.getTopTools(limit);
  }

  @Get('dispute-overview')
  @ApiOperation({ summary: 'Get dispute overview' })
  @ApiResponse({ status: 200, description: 'Dispute overview data' })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d', '1y'] })
  async getDisputeOverview() {
    return this.adminDashboardService.getDisputeOverview();
  }
}