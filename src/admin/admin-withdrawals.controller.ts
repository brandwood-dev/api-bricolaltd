import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
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
import { WithdrawalProcessingService } from '../wallets/withdrawal-processing.service';
import { WiseService } from '../wallets/wise-enhanced.service';
import { TransactionStatus } from '../transactions/enums/transaction-status.enum';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { WalletsService } from '../wallets/wallets.service';
import { AdminNotificationsService } from './admin-notifications.service';
import {
  NotificationPriority,
  NotificationCategory,
  NotificationType,
} from './dto/admin-notifications.dto';
import { CreateWalletDto } from '../wallets/dto/create-wallet.dto';
import { Transaction } from '../transactions/entities/transaction.entity';
import { TransactionType } from '../transactions/enums/transaction-type.enum';
import { ADMIN_EMAIL, ADMIN_USER_ID } from '../config/constants';

@ApiTags('admin-withdrawals')
@Controller('admin/withdrawals')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminWithdrawalsController {
  constructor(
    private readonly withdrawalProcessingService: WithdrawalProcessingService,
    private readonly wiseService: WiseService,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly walletsService: WalletsService,
    @InjectRepository(Transaction)
    private readonly transactionsRepository: Repository<Transaction>,
    private readonly adminNotificationsService: AdminNotificationsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all withdrawal requests (paginated)' })
  @ApiResponse({
    status: 200,
    description: 'Return paginated withdrawal requests.',
  })
  @ApiQuery({ name: 'status', required: false, enum: TransactionStatus })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async getAllWithdrawals(
    @Query('status') status?: TransactionStatus,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const qb = this.transactionsRepository
      .createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.sender', 'sender')
      .leftJoinAndSelect('transaction.recipient', 'recipient')
      .where('transaction.type = :type', { type: TransactionType.WITHDRAWAL })
      .orderBy('transaction.createdAt', 'DESC');
      if (search) {
        qb.andWhere(
          'LOWER(sender.firstName) LIKE LOWER(:search) OR LOWER(sender.lastName) LIKE LOWER(:search) OR LOWER(sender.email) LIKE LOWER(:search)',
          { search: `%${search}%` },
        );
      }
      if (startDate && endDate) {
        qb.andWhere('transaction.createdAt BETWEEN :startDate AND :endDate', {
          startDate: new Date(startDate),
          endDate: new Date(endDate),
        });
      }
     

    if (status) {
      qb.andWhere('transaction.status = :status', { status });
    }

    const [rows, total] = await qb
      .skip((Number(page) - 1) * Number(limit))
      .take(Number(limit))
      .getManyAndCount();

    const statusMap: Record<string, string> = {
      PENDING: 'pending',
      PROCESSING: 'confirmed',
      CONFIRMED: 'confirmed',
      COMPLETED: 'completed',
      FAILED: 'rejected',
      CANCELLED: 'rejected',
      REFUNDED: 'completed',
      PAID: 'completed',
    };

    const data = rows.map((t) => ({
      id: t.id,
      amount: Number(t.amount),
      fees: 0,
      netAmount: Number(t.amount),
      paymentMethod:
        (t as any).paymentMethod ||
        ((t as any).wizeTransferId ? 'bank_transfer' : 'stripe_connect'),
      status: statusMap[String(t.status)] || 'pending',
      type: 'user',
      createdAt: t.createdAt,
      requestDate: t.createdAt,
      processedDate: t.processedAt,
      user: t.sender
        ? {
            userId: (t.sender as any).id,
            firstName: (t.sender as any).firstName,
            lastName: (t.sender as any).lastName,
            email: (t.sender as any).email,
            phoneNumber: (t.sender as any).phoneNumber,
          }
        : undefined,
      bankDetails:
        (t as any).wizeResponse || (t as any).providerMetadata || undefined,
    }));

    return {
      success: true,
      data: {
        data,
        total,
        page: Number(page),
        limit: Number(limit),
      },
      message: 'Request successful',
    };
  }

  @Get('pending')
  @ApiOperation({ summary: 'Get pending withdrawal requests (paginated)' })
  @ApiResponse({
    status: 200,
    description: 'Return paginated pending withdrawal requests.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getPendingWithdrawals(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    const qb = this.transactionsRepository
      .createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.sender', 'sender')
      .leftJoinAndSelect('transaction.recipient', 'recipient')
      .where('transaction.type = :type', { type: TransactionType.WITHDRAWAL })
      .andWhere('transaction.status = :status', {
        status: TransactionStatus.PENDING,
      })
      .orderBy('transaction.createdAt', 'DESC');

    const [rows, total] = await qb
      .skip((Number(page) - 1) * Number(limit))
      .take(Number(limit))
      .getManyAndCount();

    const data = rows.map((t) => ({
      id: t.id,
      amount: Number(t.amount),
      fees: 0,
      netAmount: Number(t.amount),
      paymentMethod:
        (t as any).paymentMethod ||
        ((t as any).wizeTransferId ? 'bank_transfer' : 'stripe_connect'),
      status: 'pending',
      type: 'user',
      createdAt: t.createdAt,
      requestDate: t.createdAt,
      processedDate: t.processedAt,
      user: t.sender
        ? {
            firstName: (t.sender as any).firstName,
            lastName: (t.sender as any).lastName,
            email: (t.sender as any).email,
            phoneNumber: (t.sender as any).phoneNumber,
          }
        : undefined,
      bankDetails:
        (t as any).wizeResponse || (t as any).providerMetadata || undefined,
    }));

    return {
      success: true,
      data: {
        data,
        total,
        page: Number(page),
        limit: Number(limit),
      },
      message: 'Request successful',
    };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get withdrawal statistics for admin dashboard' })
  @ApiResponse({ status: 200, description: 'Return withdrawal statistics.' })
  async getWithdrawalStats() {
    const baseQB = this.transactionsRepository
      .createQueryBuilder('transaction')
      .where('transaction.type = :type', { type: TransactionType.WITHDRAWAL });

    const pendingCount = await baseQB
      .clone()
      .andWhere('transaction.status = :s', { s: TransactionStatus.PENDING })
      .getCount();
    const approvedCount = await baseQB
      .clone()
      .andWhere('transaction.status IN (:...s)', {
        s: [TransactionStatus.PROCESSING, TransactionStatus.CONFIRMED],
      })
      .getCount();
    const completedCount = await baseQB
      .clone()
      .andWhere('transaction.status = :s', { s: TransactionStatus.COMPLETED })
      .getCount();
    const rejectedCount = await baseQB
      .clone()
      .andWhere('transaction.status IN (:...s)', {
        s: [TransactionStatus.FAILED, TransactionStatus.CANCELLED],
      })
      .getCount();

    const totalAmountResult = await baseQB
      .clone()
      .select('SUM(transaction.amount)', 'sum')
      .getRawOne();
    const completedAmountResult = await baseQB
      .clone()
      .select('SUM(transaction.amount)', 'sum')
      .andWhere('transaction.status = :s', { s: TransactionStatus.COMPLETED })
      .getRawOne();

    const stats = {
      pendingCount,
      approvedCount,
      completedCount,
      rejectedCount,
      totalAmount: parseFloat(totalAmountResult?.sum || '0'),
      totalFees: 0,
      completedAmount: parseFloat(completedAmountResult?.sum || '0'),
    };

    return { success: true, data: stats, message: 'Request successful' };
  }

  private async resolveAdminUserId(): Promise<string | null> {
    try {
      if (ADMIN_EMAIL) {
        const user = await this.usersRepository.findOne({
          where: { email: ADMIN_EMAIL },
        });
        if (user?.id) return user.id;
      }
      if (ADMIN_USER_ID) return ADMIN_USER_ID;
      return null;
    } catch {
      return ADMIN_USER_ID ?? null;
    }
  }

  @Get('platform-wallet')
  @ApiOperation({ summary: 'Get platform (admin) wallet metrics' })
  @ApiResponse({
    status: 200,
    description: 'Return admin wallet balances and withdrawals sum.',
  })
  async getPlatformWallet() {
    const adminUserId = await this.resolveAdminUserId();
    if (!adminUserId) {
      return {
        success: false,
        message: 'Admin user not configured',
      };
    }

    const wallet = await this.walletsService.findByUserId(adminUserId);
    const completedWithdrawalsSumRaw = await this.transactionsRepository
      .createQueryBuilder('transaction')
      .select('SUM(transaction.amount)', 'sum')
      .where('transaction.type = :type', { type: TransactionType.WITHDRAWAL })
      .andWhere('transaction.status = :status', {
        status: TransactionStatus.COMPLETED,
      })
      .getRawOne();

    const completedWithdrawalsSum = parseFloat(
      completedWithdrawalsSumRaw?.sum || '0',
    );
    // sum des reserved_balance de tout les utilisateurs via wallet service
    const reservedBalanceSumRaw =
      await this.walletsService.getReservedBalanceSum();
    console.log(
      `[WALLET_METRICS] reservedBalanceSumRaw: ${reservedBalanceSumRaw}€`,
    );
    const reservedBalanceSum = parseFloat(reservedBalanceSumRaw.sum || '0');
    console.log(`[WALLET_METRICS] reservedBalanceSum: ${reservedBalanceSum}€`);

    // Solde cumulé S: reserved_balance - wallet_admin.reservedBalance
    const cumulativeBalance = Math.max(
      Number(reservedBalanceSum - wallet.reservedBalance),
      0,
    );
    console.log(`[WALLET_METRICS] cumulativeBalance: ${cumulativeBalance}€`);
    return {
      success: true,
      data: {
        wallet: {
          id: wallet.id,
          balance: Number(wallet.balance),
          pendingBalance: Number(wallet.pendingBalance),
          reservedBalance: Number(wallet.reservedBalance),
          currency: 'GBP',
        },
        totals: {
          totalConfirmedWithdrawals: completedWithdrawalsSum,
        },
        walletMetrics: {
          cumulativeBalance,
        },
      },
      message: 'Request successful',
    };
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve and process a withdrawal request' })
  @ApiResponse({
    status: 200,
    description: 'Withdrawal approved and processed.',
  })
  @ApiResponse({ status: 400, description: 'Bad request or processing error.' })
  async approveWithdrawal(
    @Param('id') transactionId: string,
    @Body()
    approvalData: {
      stripeAccountId?: string;
      bankAccountDetails?: {
        iban?: string;
        bic?: string;
        accountHolderName?: string;
        accountNumber?: string;
        routingNumber?: string;
        currency?: string;
      };
      method?: 'wise' | 'stripe_connect' | 'stripe_payout';
    },
  ) {
    return this.withdrawalProcessingService.processWithdrawal(
      transactionId,
      approvalData.stripeAccountId,
      approvalData.bankAccountDetails,
      approvalData.method,
    );
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject a withdrawal request' })
  @ApiResponse({ status: 200, description: 'Withdrawal rejected.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  async rejectWithdrawal(
    @Param('id') transactionId: string,
    @Body() rejectionData: { reason: string },
  ) {
    return this.withdrawalProcessingService.cancelWithdrawal(
      transactionId,
      rejectionData.reason,
    );
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a withdrawal request' })
  @ApiResponse({ status: 200, description: 'Withdrawal cancelled.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  async cancelWithdrawal(
    @Param('id') transactionId: string,
    @Body() cancellationData: { reason: string },
  ) {
    return this.withdrawalProcessingService.cancelWithdrawal(
      transactionId,
      cancellationData.reason,
    );
  }

  @Post('test')
  @ApiOperation({ summary: 'Create a test withdrawal for a user by email' })
  @ApiResponse({ status: 201, description: 'Test withdrawal created.' })
  async createTestWithdrawal(@Body() body: { email: string; amount?: number }) {
    const user = await this.usersRepository.findOne({
      where: { email: body.email },
    });
    if (!user) {
      throw new Error('User not found');
    }
    const amount = body.amount && body.amount > 0 ? body.amount : 600;
    try {
      await this.walletsService.findByUserId(user.id);
    } catch {
      const dto: CreateWalletDto = { userId: user.id } as any;
      await this.walletsService.create(dto);
    }
    const tx = await this.walletsService.createWithdrawal(user.id, amount, {});
    try {
      await this.adminNotificationsService.createPaymentNotification(
        'Nouvelle demande de retrait (test)',
        `Demande test de retrait £${amount.toFixed(2)} pour ${user.email}`,
        user.id,
        `${user.firstName || ''} ${user.lastName || ''}`.trim() || undefined,
        tx.id,
        NotificationPriority.MEDIUM,
      );
    } catch {}
    return tx;
  }

  @Post('wise/test-connection')
  @ApiOperation({ summary: 'Test Wise API connection' })
  @ApiResponse({ status: 200, description: 'Connection test result' })
  async testWiseConnection(): Promise<any> {
    try {
      const isConnected = await this.wiseService.testConnection();
      return {
        success: true,
        connected: isConnected,
        message: isConnected
          ? 'Wise API connection successful'
          : 'Wise API connection failed',
      };
    } catch (error) {
      return {
        success: false,
        connected: false,
        message: `Wise API connection test failed: ${error.message}`,
      };
    }
  }

  @Post('wise/create-test-recipient')
  @ApiOperation({ summary: 'Create test recipient with test bank details' })
  @ApiResponse({
    status: 201,
    description: 'Test recipient created successfully',
  })
  async createTestRecipient(): Promise<any> {
    try {
      const recipient = await this.wiseService.createTestRecipient();
      return {
        success: true,
        data: recipient,
        message: 'Test recipient created successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create test recipient: ${error.message}`,
      };
    }
  }

  @Post('wise/create-test-quote')
  @ApiOperation({ summary: 'Create test quote for currency conversion' })
  @ApiResponse({ status: 201, description: 'Test quote created successfully' })
  async createTestQuote(): Promise<any> {
    try {
      const quote = await this.wiseService.createQuote({
        sourceCurrency: 'GBP',
        targetCurrency: 'EUR',
        sourceAmount: 100,
        profile: Number(this.wiseService['profileId'] || '0'),
        payOut: 'BANK_TRANSFER',
      });
      return {
        success: true,
        data: quote,
        message: 'Test quote created successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create test quote: ${error.message}`,
      };
    }
  }

  @Get('wise/recipients')
  @ApiOperation({ summary: 'List all Wise recipients' })
  @ApiResponse({
    status: 200,
    description: 'Recipients retrieved successfully',
  })
  async listWiseRecipients(): Promise<any> {
    try {
      const recipients = await this.wiseService.listRecipientAccounts();
      return {
        success: true,
        data: recipients,
        message: 'Recipients retrieved successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to list recipients: ${error.message}`,
      };
    }
  }

  @Get('wise/balance')
  @ApiOperation({ summary: 'Get Wise account balance' })
  @ApiResponse({ status: 200, description: 'Balance retrieved successfully' })
  async getWiseBalance(): Promise<any> {
    try {
      const balance = await this.wiseService.getAccountBalance();
      return {
        success: true,
        data: balance,
        message: 'Balance retrieved successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to get balance: ${error.message}`,
      };
    }
  }
}
