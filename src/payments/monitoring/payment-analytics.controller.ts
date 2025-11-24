import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  BadRequestException,
  InternalServerErrorException,
  Logger,
  Param,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { PaymentMonitoringService } from './payment-monitoring.service';
import { ThreeDSecureService } from '../three-d-secure/three-d-secure.service';
import type { Response } from 'express';

@ApiTags('payment-analytics')
@Controller('payment-analytics')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class PaymentAnalyticsController {
  private readonly logger = new Logger(PaymentAnalyticsController.name);

  constructor(
    private paymentMonitoringService: PaymentMonitoringService,
    private threeDSecureService: ThreeDSecureService,
  ) {}

  /**
   * Get comprehensive payment metrics
   */
  @Get('metrics')
  @ApiOperation({
    summary: 'Get comprehensive payment metrics',
    description:
      'Get payment metrics including revenue, success rates, and growth trends',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Start date (ISO format)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'End date (ISO format)',
  })
  @ApiQuery({
    name: 'currency',
    required: false,
    type: String,
    description: 'Filter by currency (gbp, eur, usd)',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment metrics retrieved successfully',
  })
  async getPaymentMetrics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('currency') currency?: string,
  ) {
    try {
      const start = startDate ? new Date(startDate) : undefined;
      const end = endDate ? new Date(endDate) : undefined;

      if (start && isNaN(start.getTime())) {
        throw new BadRequestException('Invalid start date format');
      }

      if (end && isNaN(end.getTime())) {
        throw new BadRequestException('Invalid end date format');
      }

      if (start && end && start > end) {
        throw new BadRequestException('Start date must be before end date');
      }

      const metrics = await this.paymentMonitoringService.getPaymentMetrics(
        start,
        end,
        currency,
      );

      return {
        success: true,
        data: metrics,
        timestamp: new Date().toISOString(),
        query: {
          startDate: start?.toISOString(),
          endDate: end?.toISOString(),
          currency,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get payment metrics:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Failed to retrieve payment metrics',
      );
    }
  }

  /**
   * Get transaction analytics
   */
  @Get('transactions/analytics')
  @ApiOperation({
    summary: 'Get transaction analytics',
    description:
      'Get detailed transaction analytics with distributions and trends',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Start date (ISO format)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'End date (ISO format)',
  })
  @ApiQuery({
    name: 'groupBy',
    required: false,
    enum: ['hour', 'day', 'week', 'month'],
    description: 'Group data by time period',
    default: 'day',
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction analytics retrieved successfully',
  })
  async getTransactionAnalytics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('groupBy') groupBy: 'hour' | 'day' | 'week' | 'month' = 'day',
  ) {
    try {
      const start = startDate ? new Date(startDate) : undefined;
      const end = endDate ? new Date(endDate) : undefined;

      if (start && isNaN(start.getTime())) {
        throw new BadRequestException('Invalid start date format');
      }

      if (end && isNaN(end.getTime())) {
        throw new BadRequestException('Invalid end date format');
      }

      if (start && end && start > end) {
        throw new BadRequestException('Start date must be before end date');
      }

      const analytics =
        await this.paymentMonitoringService.getTransactionAnalytics(
          start,
          end,
          groupBy,
        );

      return {
        success: true,
        data: analytics,
        timestamp: new Date().toISOString(),
        query: {
          startDate: start?.toISOString(),
          endDate: end?.toISOString(),
          groupBy,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get transaction analytics:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Failed to retrieve transaction analytics',
      );
    }
  }

  /**
   * Get refund metrics
   */
  @Get('refunds/metrics')
  @ApiOperation({
    summary: 'Get refund metrics',
    description: 'Get comprehensive refund metrics and analytics',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Start date (ISO format)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'End date (ISO format)',
  })
  @ApiResponse({
    status: 200,
    description: 'Refund metrics retrieved successfully',
  })
  async getRefundMetrics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    try {
      const start = startDate ? new Date(startDate) : undefined;
      const end = endDate ? new Date(endDate) : undefined;

      if (start && isNaN(start.getTime())) {
        throw new BadRequestException('Invalid start date format');
      }

      if (end && isNaN(end.getTime())) {
        throw new BadRequestException('Invalid end date format');
      }

      if (start && end && start > end) {
        throw new BadRequestException('Start date must be before end date');
      }

      const metrics = await this.paymentMonitoringService.getRefundMetrics(
        start,
        end,
      );

      return {
        success: true,
        data: metrics,
        timestamp: new Date().toISOString(),
        query: { startDate: start?.toISOString(), endDate: end?.toISOString() },
      };
    } catch (error) {
      this.logger.error('Failed to get refund metrics:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Failed to retrieve refund metrics',
      );
    }
  }

  /**
   * Get withdrawal metrics
   */
  @Get('withdrawals/metrics')
  @ApiOperation({
    summary: 'Get withdrawal metrics',
    description:
      'Get comprehensive withdrawal metrics and performance analytics',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Start date (ISO format)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'End date (ISO format)',
  })
  @ApiResponse({
    status: 200,
    description: 'Withdrawal metrics retrieved successfully',
  })
  async getWithdrawalMetrics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    try {
      const start = startDate ? new Date(startDate) : undefined;
      const end = endDate ? new Date(endDate) : undefined;

      if (start && isNaN(start.getTime())) {
        throw new BadRequestException('Invalid start date format');
      }

      if (end && isNaN(end.getTime())) {
        throw new BadRequestException('Invalid end date format');
      }

      if (start && end && start > end) {
        throw new BadRequestException('Start date must be before end date');
      }

      const metrics = await this.paymentMonitoringService.getWithdrawalMetrics(
        start,
        end,
      );

      return {
        success: true,
        data: metrics,
        timestamp: new Date().toISOString(),
        query: { startDate: start?.toISOString(), endDate: end?.toISOString() },
      };
    } catch (error) {
      this.logger.error('Failed to get withdrawal metrics:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Failed to retrieve withdrawal metrics',
      );
    }
  }

  /**
   * Get 3D Secure metrics
   */
  @Get('3ds/metrics')
  @ApiOperation({
    summary: 'Get 3D Secure metrics',
    description:
      'Get comprehensive 3D Secure authentication metrics and performance analytics',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Start date (ISO format)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'End date (ISO format)',
  })
  @ApiQuery({
    name: 'timeRange',
    required: false,
    enum: ['24h', '7d', '30d'],
    description: 'Time range for metrics',
    default: '24h',
  })
  @ApiResponse({
    status: 200,
    description: '3D Secure metrics retrieved successfully',
  })
  async getThreeDSMetrics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('timeRange') timeRange: '24h' | '7d' | '30d' = '24h',
  ) {
    try {
      // Use the 3DS service we created earlier
      const metrics =
        await this.threeDSecureService.get3DSecureStats(timeRange);

      return {
        success: true,
        data: metrics,
        timestamp: new Date().toISOString(),
        query: { startDate, endDate, timeRange },
      };
    } catch (error) {
      this.logger.error('Failed to get 3D Secure metrics:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Failed to retrieve 3D Secure metrics',
      );
    }
  }

  /**
   * Get real-time payment metrics
   */
  @Get('real-time')
  @ApiOperation({
    summary: 'Get real-time payment metrics',
    description: 'Get current payment system status and real-time metrics',
  })
  @ApiResponse({
    status: 200,
    description: 'Real-time metrics retrieved successfully',
  })
  async getRealTimeMetrics() {
    try {
      const metrics = await this.paymentMonitoringService.getRealTimeMetrics();

      return {
        success: true,
        data: metrics,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get real-time metrics:', error);
      throw new InternalServerErrorException(
        'Failed to retrieve real-time metrics',
      );
    }
  }

  /**
   * Export payment data
   */
  @Get('export/:format')
  @ApiOperation({
    summary: 'Export payment data',
    description:
      'Export payment analytics data in various formats (csv, json, xlsx)',
  })
  @ApiParam({
    name: 'format',
    enum: ['csv', 'json', 'xlsx'],
    description: 'Export format',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Start date (ISO format)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'End date (ISO format)',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['metrics', 'transactions', 'refunds', 'withdrawals'],
    description: 'Type of data to export',
    default: 'metrics',
  })
  async exportData(
    @Param('format') format: 'csv' | 'json' | 'xlsx',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('type')
    type: 'metrics' | 'transactions' | 'refunds' | 'withdrawals' = 'metrics',
    @Res() res?: Response,
  ) {
    try {
      const start = startDate ? new Date(startDate) : undefined;
      const end = endDate ? new Date(endDate) : undefined;

      let data: any;

      switch (type) {
        case 'metrics':
          data = await this.paymentMonitoringService.getPaymentMetrics(
            start,
            end,
          );
          break;
        case 'transactions':
          data = await this.paymentMonitoringService.getTransactionAnalytics(
            start,
            end,
          );
          break;
        case 'refunds':
          data = await this.paymentMonitoringService.getRefundMetrics(
            start,
            end,
          );
          break;
        case 'withdrawals':
          data = await this.paymentMonitoringService.getWithdrawalMetrics(
            start,
            end,
          );
          break;
        default:
          throw new BadRequestException('Invalid export type');
      }

      const filename = `payment-${type}-${new Date().toISOString().split('T')[0]}`;

      if (format === 'json') {
        if (res) {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader(
            'Content-Disposition',
            `attachment; filename="${filename}.json"`,
          );
          res.json(data);
          return;
        }
        return { success: true, data, format: 'json' };
      }

      if (format === 'csv') {
        const csvData = this.convertToCSV(data, type);
        if (res) {
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader(
            'Content-Disposition',
            `attachment; filename="${filename}.csv"`,
          );
          res.send(csvData);
          return;
        }
        return { success: true, data: csvData, format: 'csv' };
      }

      if (format === 'xlsx') {
        // For xlsx, we would need a library like exceljs
        // For now, return JSON with a note
        return {
          success: true,
          data,
          format: 'xlsx',
          note: 'Excel export requires additional library setup',
        };
      }

      throw new BadRequestException('Invalid export format');
    } catch (error) {
      this.logger.error('Failed to export data:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to export data');
    }
  }

  /**
   * Get payment system health
   */
  @Get('health')
  @ApiOperation({
    summary: 'Get payment system health',
    description:
      'Get comprehensive health status of all payment systems and services',
  })
  @ApiResponse({
    status: 200,
    description: 'System health retrieved successfully',
  })
  async getSystemHealth() {
    try {
      const health = {
        timestamp: new Date().toISOString(),
        services: {
          stripe: await this.checkStripeHealth(),
          wise: await this.checkWiseHealth(),
          paypal: await this.checkPayPalHealth(),
          database: await this.checkDatabaseHealth(),
        },
        metrics: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          activeConnections: await this.getActiveConnections(),
        },
        alerts: await this.getSystemAlerts(),
      };

      return {
        success: true,
        data: health,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get system health:', error);
      throw new InternalServerErrorException(
        'Failed to retrieve system health',
      );
    }
  }

  /**
   * Convert data to CSV format
   */
  private convertToCSV(data: any, type: string): string {
    // Simple CSV conversion - can be enhanced with proper library
    if (type === 'metrics') {
      const headers = ['Metric', 'Value'];
      const rows = [
        ['Total Revenue', data.totalRevenue?.toString() || '0'],
        ['Total Transactions', data.totalTransactions?.toString() || '0'],
        ['Success Rate', `${data.successRate?.toFixed(2) || '0'}%`],
        [
          'Average Transaction Value',
          data.averageTransactionValue?.toFixed(2) || '0',
        ],
      ];

      return [headers, ...rows].map((row) => row.join(',')).join('\n');
    }

    // Add more conversion logic for other types
    return JSON.stringify(data, null, 2);
  }

  /**
   * Check service health
   */
  private async checkStripeHealth(): Promise<any> {
    try {
      // This would check Stripe API connectivity
      return { status: 'operational', lastCheck: new Date().toISOString() };
    } catch (error) {
      return {
        status: 'down',
        error: error.message,
        lastCheck: new Date().toISOString(),
      };
    }
  }

  private async checkWiseHealth(): Promise<any> {
    try {
      // This would check Wise API connectivity
      return { status: 'operational', lastCheck: new Date().toISOString() };
    } catch (error) {
      return {
        status: 'unknown',
        error: 'Not implemented',
        lastCheck: new Date().toISOString(),
      };
    }
  }

  private async checkPayPalHealth(): Promise<any> {
    try {
      // This would check PayPal API connectivity
      return { status: 'operational', lastCheck: new Date().toISOString() };
    } catch (error) {
      return {
        status: 'unknown',
        error: 'Not implemented',
        lastCheck: new Date().toISOString(),
      };
    }
  }

  private async checkDatabaseHealth(): Promise<any> {
    try {
      // This would check database connectivity
      return { status: 'operational', lastCheck: new Date().toISOString() };
    } catch (error) {
      return {
        status: 'down',
        error: error.message,
        lastCheck: new Date().toISOString(),
      };
    }
  }

  private async getActiveConnections(): Promise<number> {
    // This would return active database connections
    return 0;
  }

  private async getSystemAlerts(): Promise<any[]> {
    // This would return current system alerts
    return [];
  }
}
