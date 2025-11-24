import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
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
import { AdminTransactionsService } from './admin-transactions.service';
import { TransactionFilterParams } from '../transactions/dto/transaction-filter.dto';
import { UpdateTransactionDto } from '../transactions/dto/update-transaction.dto';
import { TransactionStatus } from '../transactions/enums/transaction-status.enum';

@ApiTags('admin-transactions')
@Controller('admin/transactions')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminTransactionsController {
  constructor(
    private readonly adminTransactionsService: AdminTransactionsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all transactions for admin' })
  @ApiResponse({ status: 200, description: 'Return paginated transactions.' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, type: String })
  @ApiQuery({ name: 'start_date', required: false, type: String })
  @ApiQuery({ name: 'end_date', required: false, type: String })
  async getTransactions(@Query() filters: TransactionFilterParams) {
    return this.adminTransactionsService.getTransactions(filters);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get transaction statistics for admin dashboard' })
  @ApiResponse({ status: 200, description: 'Return transaction statistics.' })
  @ApiQuery({ name: 'start_date', required: false, type: String })
  @ApiQuery({ name: 'end_date', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, type: String })
  async getTransactionStats(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('type') type?: string,
  ) {
    return this.adminTransactionsService.getTransactionStats(
      startDate,
      endDate,
      type,
    );
  }

  @Get('by-type')
  @ApiOperation({ summary: 'Get transactions grouped by type' })
  @ApiResponse({ status: 200, description: 'Return transactions by type.' })
  async getTransactionsByType() {
    return this.adminTransactionsService.getTransactionsByType();
  }

  @Get('by-status')
  @ApiOperation({ summary: 'Get transactions grouped by status' })
  @ApiResponse({ status: 200, description: 'Return transactions by status.' })
  async getTransactionsByStatus() {
    return this.adminTransactionsService.getTransactionsByStatus();
  }

  @Get('disputed')
  @ApiOperation({ summary: 'Get disputed transactions' })
  @ApiResponse({ status: 200, description: 'Return disputed transactions.' })
  async getDisputedTransactions(@Query() filters: TransactionFilterParams) {
    return this.adminTransactionsService.getDisputedTransactions(filters);
  }

  @Get('failed')
  @ApiOperation({ summary: 'Get failed transactions' })
  @ApiResponse({ status: 200, description: 'Return failed transactions.' })
  async getFailedTransactions(@Query() filters: TransactionFilterParams) {
    return this.adminTransactionsService.getFailedTransactions(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get transaction details by ID' })
  @ApiResponse({ status: 200, description: 'Return transaction details.' })
  @ApiResponse({ status: 404, description: 'Transaction not found.' })
  async getTransactionById(@Param('id') id: string) {
    return this.adminTransactionsService.getTransactionById(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update transaction status' })
  @ApiResponse({
    status: 200,
    description: 'Transaction status updated successfully.',
  })
  @ApiResponse({ status: 404, description: 'Transaction not found.' })
  async updateTransactionStatus(
    @Param('id') id: string,
    @Body() updateData: { status: TransactionStatus; reason?: string },
  ) {
    return this.adminTransactionsService.updateTransactionStatus(
      id,
      updateData.status,
      updateData.reason,
    );
  }

  @Post('refund')
  @ApiOperation({ summary: 'Process transaction refund' })
  @ApiResponse({ status: 200, description: 'Refund processed successfully.' })
  @ApiResponse({ status: 404, description: 'Transaction not found.' })
  async processRefund(
    @Body()
    refundData: {
      transactionId: string;
      amount: number;
      reason: string;
      notifyUser?: boolean;
    },
  ) {
    return this.adminTransactionsService.processRefund(refundData);
  }

  @Post('bulk-action')
  @ApiOperation({ summary: 'Perform bulk action on transactions' })
  @ApiResponse({
    status: 200,
    description: 'Bulk action completed successfully.',
  })
  async performBulkAction(
    @Body()
    bulkData: {
      transactionIds: string[];
      action: string;
      reason?: string;
    },
  ) {
    return this.adminTransactionsService.performBulkAction(bulkData);
  }

  @Post(':id/retry')
  @ApiOperation({ summary: 'Retry failed transaction' })
  @ApiResponse({ status: 200, description: 'Transaction retry initiated.' })
  @ApiResponse({ status: 404, description: 'Transaction not found.' })
  async retryFailedTransaction(@Param('id') id: string) {
    return this.adminTransactionsService.retryFailedTransaction(id);
  }
}
