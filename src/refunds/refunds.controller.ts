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
  Logger,
  Ip,
  Headers,
  BadRequestException,
  ValidationPipe,
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
import { Request } from '@nestjs/common';

import { RefundsService, RefundResult } from './refunds.service';
import { Refund, RefundStatus, RefundReason } from './entities/refund.entity';
import {
  CreateRefundDto,
  ProcessRefundDto,
  UpdateRefundStatusDto,
  RefundResponseDto,
  RefundListResponseDto,
  RefundStatsDto,
  BulkRefundDto,
} from './dto/refund.dto';
import { AdminNotificationsService } from '../admin/admin-notifications.service';
import {
  NotificationCategory as AdminNotificationCategory,
  NotificationPriority as AdminNotificationPriority,
  NotificationType as AdminNotificationType,
} from '../admin/dto/admin-notifications.dto';

@ApiTags('refunds')
@Controller('refunds')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RefundsController {
  private readonly logger = new Logger(RefundsController.name);

  constructor(
    private readonly refundsService: RefundsService,
    private readonly adminNotificationsService: AdminNotificationsService,
  ) {}

  /**
   * Create a refund request (user or admin)
   */
  @Post('request')
  @ApiOperation({ summary: 'Create a refund request' })
  @ApiResponse({
    status: 201,
    description: 'Refund request created successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid input' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async createRefundRequest(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    createRefundDto: CreateRefundDto,
    @Request() req: any,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ): Promise<RefundResult> {
    try {
      this.logger.log(`Creating refund request for user ${req.user.id}`, {
        transactionId: createRefundDto.transactionId,
        amount: createRefundDto.amount,
        reason: createRefundDto.reason,
        ipAddress,
      });

      const result = await this.refundsService.createRefundRequest(
        createRefundDto,
        req.user.id,
        ipAddress,
        userAgent,
      );

      if (result.success) {
        // Create admin notification for new refund request
        await this.adminNotificationsService.createAdminNotification({
          title: 'New Refund Request',
          message: `User ${req.user.email} requested refund for transaction ${createRefundDto.transactionId}. Amount: £${result.amountRefunded?.toFixed(2)}. Reason: ${createRefundDto.reason}`,
          type: AdminNotificationType.INFO,
          priority: AdminNotificationPriority.MEDIUM,
          category: AdminNotificationCategory.PAYMENT,
        });
      }

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to create refund request for user ${req.user.id}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Process a refund (admin only)
   */
  @Post('process')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Process a refund (admin only)' })
  @ApiResponse({ status: 200, description: 'Refund processed successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid input' })
  @ApiResponse({ status: 404, description: 'Refund not found' })
  async processRefund(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    processRefundDto: ProcessRefundDto,
    @Request() req: any,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ): Promise<RefundResult> {
    try {
      this.logger.log(`Processing refund by admin ${req.user.id}`, {
        refundId: processRefundDto.refundId,
        amount: processRefundDto.amount,
        ipAddress,
      });

      const result = await this.refundsService.processRefund(
        processRefundDto.refundId,
        req.user.id,
        ipAddress,
        userAgent,
      );

      if (result.success) {
        // Create admin notification for successful refund
        await this.adminNotificationsService.createAdminNotification({
          title: 'Refund Processed Successfully',
          message: `Admin ${req.user.email} processed refund ${processRefundDto.refundId}. Amount: £${result.amountRefunded?.toFixed(2)}. Stripe Refund ID: ${result.stripeRefundId}`,
          type: AdminNotificationType.SUCCESS,
          priority: AdminNotificationPriority.MEDIUM,
          category: AdminNotificationCategory.PAYMENT,
        });
      } else {
        // Create admin notification for failed refund
        await this.adminNotificationsService.createAdminNotification({
          title: 'Refund Processing Failed',
          message: `Admin ${req.user.email} failed to process refund ${processRefundDto.refundId}. Error: ${result.error}`,
          type: AdminNotificationType.ERROR,
          priority: AdminNotificationPriority.HIGH,
          category: AdminNotificationCategory.PAYMENT,
        });
      }

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to process refund by admin ${req.user.id}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Process a refund via Wise for international transfers (admin only)
   */
  @Post('process-wise')
  @UseGuards(AdminGuard)
  @ApiOperation({
    summary:
      'Process a refund via Wise for international transfers (admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Refund processed via Wise successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid refund data' })
  @ApiResponse({ status: 404, description: 'Refund not found' })
  async processRefundViaWise(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    processRefundDto: ProcessRefundDto & {
      targetCurrency?: string;
      bankDetails?: {
        iban: string;
        bic: string;
        accountHolderName: string;
      };
    },
    @Request() req: any,
  ): Promise<any> {
    try {
      this.logger.log(
        `Admin ${req.user.id} processing refund via Wise: ${processRefundDto.refundId}`,
      );

      const result = await this.refundsService.processRefundViaWise(
        processRefundDto.refundId,
        req.user.id,
        processRefundDto.targetCurrency || 'EUR',
        processRefundDto.bankDetails,
      );

      // Create admin notification
      await this.adminNotificationsService.createAdminNotification({
        title: 'Refund Processed via Wise Successfully',
        message: `Admin ${req.user.email} processed refund ${processRefundDto.refundId} via Wise. Amount: £${result.refund.refundAmount.toFixed(2)}. Transfer ID: ${result.transfer.id}`,
        type: AdminNotificationType.SUCCESS,
        priority: AdminNotificationPriority.MEDIUM,
        category: AdminNotificationCategory.PAYMENT,
      });

      return {
        success: true,
        message: 'Refund processed via Wise successfully',
        refundId: result.refund.id,
        transferId: result.transfer.id,
        quoteId: result.quote.id,
        recipientId: result.recipient?.id,
      };
    } catch (error) {
      this.logger.error(
        `Admin ${req.user.id} failed to process refund via Wise ${processRefundDto.refundId}:`,
        error,
      );

      // Create admin notification for failure
      await this.adminNotificationsService.createAdminNotification({
        title: 'Wise Refund Processing Failed',
        message: `Admin ${req.user.email} failed to process refund ${processRefundDto.refundId} via Wise. Error: ${error.message}`,
        type: AdminNotificationType.ERROR,
        priority: AdminNotificationPriority.HIGH,
        category: AdminNotificationCategory.PAYMENT,
      });

      throw error;
    }
  }

  /**
   * Get refund by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get refund by ID' })
  @ApiResponse({
    status: 200,
    description: 'Refund details retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Refund not found' })
  async getRefundById(
    @Param('id') refundId: string,
    @Request() req: any,
  ): Promise<Refund> {
    try {
      this.logger.log(`Getting refund ${refundId} for user ${req.user.id}`);

      const refund = await this.refundsService.getRefundById(refundId);

      // Check if user has access to this refund
      const hasAccess = await this.checkUserRefundAccess(
        refund,
        req.user.id,
        req.user.role,
      );
      if (!hasAccess) {
        throw new BadRequestException('You do not have access to this refund');
      }

      return refund;
    } catch (error) {
      this.logger.error(
        `Failed to get refund ${refundId} for user ${req.user.id}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get refunds for current user
   */
  @Get('user/my-refunds')
  @ApiOperation({ summary: 'Get refunds for current user' })
  @ApiResponse({
    status: 200,
    description: 'User refunds retrieved successfully',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  async getUserRefunds(
    @Request() req: any,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ): Promise<{
    refunds: Refund[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      this.logger.log(
        `Getting refunds for user ${req.user.id}, page ${page}, limit ${limit}`,
      );

      return await this.refundsService.getRefundsByUserId(
        req.user.id,
        page,
        limit,
      );
    } catch (error) {
      this.logger.error(
        `Failed to get refunds for user ${req.user.id}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get refunds by transaction ID
   */
  @Get('transaction/:transactionId')
  @ApiOperation({ summary: 'Get refunds by transaction ID' })
  @ApiResponse({ status: 200, description: 'Refunds retrieved successfully' })
  @ApiResponse({ status: 404, description: 'No refunds found' })
  async getRefundsByTransactionId(
    @Param('transactionId') transactionId: string,
    @Request() req: any,
  ): Promise<Refund[]> {
    try {
      this.logger.log(
        `Getting refunds for transaction ${transactionId} by user ${req.user.id}`,
      );

      const refunds =
        await this.refundsService.getRefundsByTransactionId(transactionId);

      // Check if user has access to these refunds
      for (const refund of refunds) {
        const hasAccess = await this.checkUserRefundAccess(
          refund,
          req.user.id,
          req.user.role,
        );
        if (!hasAccess) {
          throw new BadRequestException(
            'You do not have access to these refunds',
          );
        }
      }

      return refunds;
    } catch (error) {
      this.logger.error(
        `Failed to get refunds for transaction ${transactionId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get all refunds (admin only)
   */
  @Get()
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Get all refunds (admin only)' })
  @ApiResponse({ status: 200, description: 'Refunds retrieved successfully' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'status', required: false, enum: RefundStatus })
  @ApiQuery({ name: 'reason', required: false, enum: RefundReason })
  @ApiQuery({ name: 'transactionId', required: false, type: String })
  @ApiQuery({ name: 'bookingId', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async getAllRefunds(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('status') status?: RefundStatus,
    @Query('reason') reason?: RefundReason,
    @Query('transactionId') transactionId?: string,
    @Query('bookingId') bookingId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<{
    refunds: Refund[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      this.logger.log(`Getting all refunds with filters`, {
        page,
        limit,
        status,
        reason,
        transactionId,
        bookingId,
        startDate,
        endDate,
      });

      const filters = {
        status,
        reason,
        transactionId,
        bookingId,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      };

      return await this.refundsService.getAllRefunds(page, limit, filters);
    } catch (error) {
      this.logger.error('Failed to get all refunds:', error);
      throw error;
    }
  }

  /**
   * Get refund statistics (admin only)
   */
  @Get('stats/summary')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Get refund statistics (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Refund statistics retrieved successfully',
  })
  async getRefundStats(): Promise<RefundStatsDto> {
    try {
      this.logger.log('Getting refund statistics');
      return await this.refundsService.getRefundStats();
    } catch (error) {
      this.logger.error('Failed to get refund statistics:', error);
      throw error;
    }
  }

  /**
   * Update refund status (admin only)
   */
  @Put(':id/status')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Update refund status (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Refund status updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Refund not found' })
  async updateRefundStatus(
    @Param('id') refundId: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    updateDto: UpdateRefundStatusDto,
    @Request() req: any,
  ): Promise<Refund> {
    try {
      this.logger.log(
        `Updating refund ${refundId} status by admin ${req.user.id}`,
        {
          newStatus: updateDto.status,
          statusReason: updateDto.statusReason,
        },
      );

      const refund = await this.refundsService.updateRefundStatus(
        refundId,
        updateDto,
        req.user.id,
      );

      // Create admin notification
      await this.adminNotificationsService.createAdminNotification({
        title: 'Refund Status Updated',
        message: `Admin ${req.user.email} updated refund ${refundId} status to ${updateDto.status}. ${updateDto.statusReason || ''}`,
        type: AdminNotificationType.INFO,
        priority: AdminNotificationPriority.MEDIUM,
        category: AdminNotificationCategory.PAYMENT,
      });

      return refund;
    } catch (error) {
      this.logger.error(
        `Failed to update refund ${refundId} status by admin ${req.user.id}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Check if user has access to a refund
   */
  private async checkUserRefundAccess(
    refund: Refund,
    userId: string,
    userRole?: string,
  ): Promise<boolean> {
    try {
      // Admin users have access to all refunds
      if (userRole === 'admin') {
        return true;
      }

      // Check if user is involved in the original transaction
      if (refund.transaction) {
        return (
          refund.transaction.senderId === userId ||
          refund.transaction.recipientId === userId
        );
      }

      return false;
    } catch (error) {
      this.logger.error(
        `Error checking refund access for user ${userId}:`,
        error,
      );
      return false;
    }
  }
}
