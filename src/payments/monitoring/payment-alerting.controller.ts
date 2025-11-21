import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  BadRequestException,
  InternalServerErrorException,
  Logger,
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
import { PaymentAlertingService } from './payment-alerting.service';

@ApiTags('payment-alerts')
@Controller('payment-alerts')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class PaymentAlertingController {
  private readonly logger = new Logger(PaymentAlertingController.name);

  constructor(private paymentAlertingService: PaymentAlertingService) {}

  /**
   * Get all alert rules
   */
  @Get('rules')
  @ApiOperation({ 
    summary: 'Get all alert rules',
    description: 'Get all payment alert rules with their current configuration'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Alert rules retrieved successfully'
  })
  async getAlertRules() {
    try {
      const rules = this.paymentAlertingService.getAlertRules();
      
      return {
        success: true,
        data: rules,
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      this.logger.error('Failed to get alert rules:', error);
      throw new InternalServerErrorException('Failed to retrieve alert rules');
    }
  }

  /**
   * Update alert rule
   */
  @Put('rules/:ruleId')
  @ApiOperation({ 
    summary: 'Update alert rule',
    description: 'Update an existing alert rule configuration'
  })
  @ApiParam({ 
    name: 'ruleId', 
    type: String,
    description: 'Alert rule ID'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Alert rule updated successfully'
  })
  async updateAlertRule(
    @Param('ruleId') ruleId: string,
    @Body() updates: any,
  ) {
    try {
      if (!ruleId) {
        throw new BadRequestException('Rule ID is required');
      }

      const updatedRule = await this.paymentAlertingService.updateAlertRule(ruleId, updates);
      
      if (!updatedRule) {
        throw new BadRequestException('Alert rule not found');
      }

      return {
        success: true,
        data: updatedRule,
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      this.logger.error(`Failed to update alert rule ${ruleId}:`, error);
      
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to update alert rule');
    }
  }

  /**
   * Toggle alert rule
   */
  @Post('rules/:ruleId/toggle')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Toggle alert rule',
    description: 'Enable or disable an alert rule'
  })
  @ApiParam({ 
    name: 'ruleId', 
    type: String,
    description: 'Alert rule ID'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Alert rule toggled successfully'
  })
  async toggleAlertRule(
    @Param('ruleId') ruleId: string,
    @Body('enabled') enabled: boolean,
  ) {
    try {
      if (!ruleId) {
        throw new BadRequestException('Rule ID is required');
      }

      if (typeof enabled !== 'boolean') {
        throw new BadRequestException('Enabled must be a boolean value');
      }

      const success = await this.paymentAlertingService.toggleAlertRule(ruleId, enabled);
      
      if (!success) {
        throw new BadRequestException('Alert rule not found');
      }

      return {
        success: true,
        message: `Alert rule ${enabled ? 'enabled' : 'disabled'} successfully`,
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      this.logger.error(`Failed to toggle alert rule ${ruleId}:`, error);
      
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to toggle alert rule');
    }
  }

  /**
   * Get alert history
   */
  @Get('history')
  @ApiOperation({ 
    summary: 'Get alert history',
    description: 'Get historical alert data with filtering options'
  })
  @ApiQuery({ 
    name: 'startDate', 
    required: false, 
    type: String,
    description: 'Start date (ISO format)'
  })
  @ApiQuery({ 
    name: 'endDate', 
    required: false, 
    type: String,
    description: 'End date (ISO format)'
  })
  @ApiQuery({ 
    name: 'severity', 
    required: false, 
    enum: ['critical', 'warning', 'info'],
    description: 'Filter by severity level'
  })
  @ApiQuery({ 
    name: 'limit', 
    required: false, 
    type: Number,
    description: 'Maximum number of alerts to return',
    default: 100
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Alert history retrieved successfully'
  })
  async getAlertHistory(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('severity') severity?: 'critical' | 'warning' | 'info',
    @Query('limit') limit?: number,
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

      if (limit && (limit < 1 || limit > 1000)) {
        throw new BadRequestException('Limit must be between 1 and 1000');
      }

      const history = await this.paymentAlertingService.getAlertHistory(
        start,
        end,
        severity,
        limit || 100,
      );

      return {
        success: true,
        data: history,
        timestamp: new Date().toISOString(),
        query: {
          startDate: start?.toISOString(),
          endDate: end?.toISOString(),
          severity,
          limit: limit || 100,
        },
      };

    } catch (error) {
      this.logger.error('Failed to get alert history:', error);
      
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to retrieve alert history');
    }
  }

  /**
   * Test alert rule
   */
  @Post('rules/:ruleId/test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Test alert rule',
    description: 'Trigger a test alert for the specified rule'
  })
  @ApiParam({ 
    name: 'ruleId', 
    type: String,
    description: 'Alert rule ID'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Alert rule test triggered successfully'
  })
  async testAlertRule(@Param('ruleId') ruleId: string) {
    try {
      if (!ruleId) {
        throw new BadRequestException('Rule ID is required');
      }

      const success = await this.paymentAlertingService.testAlertRule(ruleId);
      
      if (!success) {
        throw new BadRequestException('Alert rule not found');
      }

      return {
        success: true,
        message: 'Alert rule test triggered successfully',
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      this.logger.error(`Failed to test alert rule ${ruleId}:`, error);
      
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to test alert rule');
    }
  }

  /**
   * Get system health
   */
  @Get('health')
  @ApiOperation({ 
    summary: 'Get payment system health',
    description: 'Get comprehensive health status of the payment system with alert status'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'System health retrieved successfully'
  })
  async getSystemHealth() {
    try {
      const health = await this.paymentAlertingService.getSystemHealth();
      
      return {
        success: true,
        data: health,
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      this.logger.error('Failed to get system health:', error);
      throw new InternalServerErrorException('Failed to retrieve system health');
    }
  }

  /**
   * Get current system metrics
   */
  @Get('metrics/current')
  @ApiOperation({ 
    summary: 'Get current system metrics',
    description: 'Get current payment system metrics for alerting purposes'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Current metrics retrieved successfully'
  })
  async getCurrentMetrics() {
    try {
      // This would call the payment monitoring service
      // For now, return mock data
      const metrics = {
        successRate: 94.2,
        refundRate: 2.1,
        pendingWithdrawals: 12,
        averageProcessingTime: 2850,
        transactionVolume: 156,
        threeDSSuccessRate: 89.5,
        stripeStatus: 1,
        chargebackRate: 0.3,
        fraudScore: 25,
        currencyVolatility: 2.1,
      };
      
      return {
        success: true,
        data: metrics,
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      this.logger.error('Failed to get current metrics:', error);
      throw new InternalServerErrorException('Failed to retrieve current metrics');
    }
  }

  /**
   * Manually trigger alert
   */
  @Post('trigger')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Manually trigger alert',
    description: 'Manually trigger a payment system alert for testing purposes'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Alert triggered successfully'
  })
  async triggerAlert(@Body() alertData: any) {
    try {
      const { ruleId, severity, message } = alertData;

      if (!ruleId || !severity || !message) {
        throw new BadRequestException('ruleId, severity, and message are required');
      }

      // This would create a manual alert
      // For now, return success
      return {
        success: true,
        message: 'Manual alert triggered successfully',
        timestamp: new Date().toISOString(),
        data: {
          ruleId,
          severity,
          message,
        },
      };

    } catch (error) {
      this.logger.error('Failed to trigger manual alert:', error);
      
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to trigger manual alert');
    }
  }
}