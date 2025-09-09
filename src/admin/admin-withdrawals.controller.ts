import { Controller, Get, Post, Patch, Param, Body, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { WithdrawalProcessingService } from '../wallets/withdrawal-processing.service';
import { TransactionStatus } from '../transactions/enums/transaction-status.enum';

@ApiTags('admin-withdrawals')
@Controller('admin/withdrawals')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminWithdrawalsController {
  constructor(
    private readonly withdrawalProcessingService: WithdrawalProcessingService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all withdrawal requests' })
  @ApiResponse({ status: 200, description: 'Return all withdrawal requests.' })
  @ApiQuery({ name: 'status', required: false, enum: TransactionStatus })
  async getAllWithdrawals(@Query('status') status?: TransactionStatus) {
    if (status) {
      // Si un statut spécifique est demandé, filtrer par ce statut
      // Pour l'instant, on retourne seulement les pending
      return this.withdrawalProcessingService.getPendingWithdrawals();
    }
    return this.withdrawalProcessingService.getPendingWithdrawals();
  }

  @Get('pending')
  @ApiOperation({ summary: 'Get pending withdrawal requests' })
  @ApiResponse({ status: 200, description: 'Return pending withdrawal requests.' })
  async getPendingWithdrawals() {
    return this.withdrawalProcessingService.getPendingWithdrawals();
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve and process a withdrawal request' })
  @ApiResponse({ status: 200, description: 'Withdrawal approved and processed.' })
  @ApiResponse({ status: 400, description: 'Bad request or processing error.' })
  async approveWithdrawal(
    @Param('id') transactionId: string,
    @Body() approvalData: {
      stripeAccountId?: string;
      bankAccountDetails?: {
        iban?: string;
        bic?: string;
        accountHolderName?: string;
      };
    }
  ) {
    return this.withdrawalProcessingService.processWithdrawal(
      transactionId,
      approvalData.stripeAccountId,
      approvalData.bankAccountDetails
    );
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject a withdrawal request' })
  @ApiResponse({ status: 200, description: 'Withdrawal rejected.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  async rejectWithdrawal(
    @Param('id') transactionId: string,
    @Body() rejectionData: { reason: string }
  ) {
    return this.withdrawalProcessingService.cancelWithdrawal(
      transactionId,
      rejectionData.reason
    );
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a withdrawal request' })
  @ApiResponse({ status: 200, description: 'Withdrawal cancelled.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  async cancelWithdrawal(
    @Param('id') transactionId: string,
    @Body() cancellationData: { reason: string }
  ) {
    return this.withdrawalProcessingService.cancelWithdrawal(
      transactionId,
      cancellationData.reason
    );
  }
}