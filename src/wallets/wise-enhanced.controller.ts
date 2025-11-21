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
  ValidationPipe,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { Request } from '@nestjs/common';

import { WiseService } from './wise-enhanced.service';
import { AdminNotificationsService } from '../admin/admin-notifications.service';
import {
  NotificationCategory as AdminNotificationCategory,
  NotificationPriority as AdminNotificationPriority,
  NotificationType as AdminNotificationType,
} from '../admin/dto/admin-notifications.dto';

// DTOs for Wise operations
export class CreateQuoteDto {
  sourceCurrency: string;
  targetCurrency: string;
  sourceAmount?: number;
  targetAmount?: number;
  profile: number;
  payOut?: 'BALANCE' | 'BANK_TRANSFER';
}

export class CreateRecipientDto {
  currency: string;
  type: string;
  profile: number;
  accountHolderName: string;
  details: {
    iban?: string;
    bic?: string;
    accountNumber?: string;
    routingNumber?: string;
    sortCode?: string;
    [key: string]: any;
  };
}

export class CreateTransferDto {
  targetAccount: string;
  quoteUuid: string;
  customerTransactionId: string;
  reference?: string;
  transferPurpose?: string;
  sourceOfFunds?: string;
}

export class FundTransferDto {
  type: 'BALANCE' | 'CARD';
}

@ApiTags('wise')
@Controller('wise')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WiseController {
  private readonly logger = new Logger(WiseController.name);

  constructor(
    private readonly wiseService: WiseService,
    private readonly adminNotificationsService: AdminNotificationsService,
  ) {}

  /**
   * Create a quote for currency conversion
   */
  @Post('quotes')
  @ApiOperation({ summary: 'Create a Wise quote' })
  @ApiResponse({ status: 201, description: 'Quote created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async createQuote(
    @Body(new ValidationPipe({ transform: true, whitelist: true })) createQuoteDto: CreateQuoteDto,
    @Request() req: any
  ): Promise<any> {
    try {
      this.logger.log(`Creating Wise quote for user ${req.user.id}`, {
        sourceCurrency: createQuoteDto.sourceCurrency,
        targetCurrency: createQuoteDto.targetCurrency,
        sourceAmount: createQuoteDto.sourceAmount,
        targetAmount: createQuoteDto.targetAmount,
      });

      const quote = await this.wiseService.createQuote(createQuoteDto);

      // Create admin notification
      await this.adminNotificationsService.createAdminNotification({
        title: 'Wise Quote Created',
        message: `User ${req.user.email} created a Wise quote: ${createQuoteDto.sourceAmount} ${createQuoteDto.sourceCurrency} → ${createQuoteDto.targetCurrency}`,
        type: AdminNotificationType.INFO,
        priority: AdminNotificationPriority.LOW,
        category: AdminNotificationCategory.PAYMENT,
      });

      return quote;
    } catch (error) {
      this.logger.error(`Failed to create Wise quote for user ${req.user.id}:`, error);
      throw error;
    }
  }

  /**
   * Get quote by ID
   */
  @Get('quotes/:id')
  @ApiOperation({ summary: 'Get Wise quote by ID' })
  @ApiResponse({ status: 200, description: 'Quote retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Quote not found' })
  async getQuote(
    @Param('id') quoteId: string,
    @Request() req: any
  ): Promise<any> {
    try {
      this.logger.log(`Getting Wise quote ${quoteId} for user ${req.user.id}`);

      const quote = await this.wiseService.getQuote(quoteId);

      return quote;
    } catch (error) {
      this.logger.error(`Failed to get Wise quote ${quoteId} for user ${req.user.id}:`, error);
      throw error;
    }
  }

  /**
   * Create a recipient account
   */
  @Post('recipients')
  @ApiOperation({ summary: 'Create a Wise recipient account' })
  @ApiResponse({ status: 201, description: 'Recipient account created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async createRecipient(
    @Body(new ValidationPipe({ transform: true, whitelist: true })) createRecipientDto: CreateRecipientDto,
    @Request() req: any
  ): Promise<any> {
    try {
      this.logger.log(`Creating Wise recipient for user ${req.user.id}`, {
        currency: createRecipientDto.currency,
        type: createRecipientDto.type,
        accountHolderName: createRecipientDto.accountHolderName,
      });

      // Validate bank details
      this.validateBankDetails(createRecipientDto);

      const recipient = await this.wiseService.createRecipientAccount(createRecipientDto);

      // Create admin notification
      await this.adminNotificationsService.createAdminNotification({
        title: 'Wise Recipient Created',
        message: `User ${req.user.email} created a Wise recipient account: ${createRecipientDto.accountHolderName}`,
        type: AdminNotificationType.INFO,
        priority: AdminNotificationPriority.LOW,
        category: AdminNotificationCategory.PAYMENT,
      });

      return recipient;
    } catch (error) {
      this.logger.error(`Failed to create Wise recipient for user ${req.user.id}:`, error);
      throw error;
    }
  }

  /**
   * Get recipient account by ID
   */
  @Get('recipients/:id')
  @ApiOperation({ summary: 'Get Wise recipient account by ID' })
  @ApiResponse({ status: 200, description: 'Recipient retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Recipient not found' })
  async getRecipient(
    @Param('id') recipientId: string,
    @Request() req: any
  ): Promise<any> {
    try {
      this.logger.log(`Getting Wise recipient ${recipientId} for user ${req.user.id}`);

      const recipient = await this.wiseService.getRecipientAccount(recipientId);

      return recipient;
    } catch (error) {
      this.logger.error(`Failed to get Wise recipient ${recipientId} for user ${req.user.id}:`, error);
      throw error;
    }
  }

  /**
   * List recipient accounts
   */
  @Get('recipients')
  @ApiOperation({ summary: 'List Wise recipient accounts' })
  @ApiResponse({ status: 200, description: 'Recipients retrieved successfully' })
  @ApiQuery({ name: 'currency', required: false, type: String })
  async listRecipients(
    @Query('currency') currency: string,
    @Request() req: any
  ): Promise<any[]> {
    try {
      this.logger.log(`Listing Wise recipients for user ${req.user.id}`, { currency });

      const recipients = await this.wiseService.listRecipientAccounts(currency);

      return recipients;
    } catch (error) {
      this.logger.error(`Failed to list Wise recipients for user ${req.user.id}:`, error);
      throw error;
    }
  }

  /**
   * Create a transfer
   */
  @Post('transfers')
  @ApiOperation({ summary: 'Create a Wise transfer' })
  @ApiResponse({ status: 201, description: 'Transfer created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async createTransfer(
    @Body(new ValidationPipe({ transform: true, whitelist: true })) createTransferDto: CreateTransferDto,
    @Request() req: any
  ): Promise<any> {
    try {
      this.logger.log(`Creating Wise transfer for user ${req.user.id}`, {
        targetAccount: createTransferDto.targetAccount,
        quoteUuid: createTransferDto.quoteUuid,
        customerTransactionId: createTransferDto.customerTransactionId,
      });

      const transfer = await this.wiseService.createTransfer(createTransferDto);

      // Create admin notification
      await this.adminNotificationsService.createAdminNotification({
        title: 'Wise Transfer Created',
        message: `User ${req.user.email} created a Wise transfer: ${createTransferDto.customerTransactionId}`,
        type: AdminNotificationType.INFO,
        priority: AdminNotificationPriority.MEDIUM,
        category: AdminNotificationCategory.PAYMENT,
      });

      return transfer;
    } catch (error) {
      this.logger.error(`Failed to create Wise transfer for user ${req.user.id}:`, error);
      throw error;
    }
  }

  /**
   * Fund a transfer
   */
  @Post('transfers/:id/fund')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Fund a Wise transfer' })
  @ApiResponse({ status: 200, description: 'Transfer funded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async fundTransfer(
    @Param('id') transferId: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true })) fundTransferDto: FundTransferDto,
    @Request() req: any
  ): Promise<any> {
    try {
      this.logger.log(`Funding Wise transfer ${transferId} for user ${req.user.id}`, {
        type: fundTransferDto.type,
      });

      const payment = await this.wiseService.fundTransfer(transferId, fundTransferDto);

      // Create admin notification
      await this.adminNotificationsService.createAdminNotification({
        title: 'Wise Transfer Funded',
        message: `User ${req.user.email} funded Wise transfer ${transferId}`,
        type: AdminNotificationType.SUCCESS,
        priority: AdminNotificationPriority.MEDIUM,
        category: AdminNotificationCategory.PAYMENT,
      });

      return payment;
    } catch (error) {
      this.logger.error(`Failed to fund Wise transfer ${transferId} for user ${req.user.id}:`, error);
      throw error;
    }
  }

  /**
   * Create and fund transfer in one operation
   */
  @Post('transfers/create-and-fund')
  @ApiOperation({ summary: 'Create and fund a Wise transfer' })
  @ApiResponse({ status: 201, description: 'Transfer created and funded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async createAndFundTransfer(
    @Body(new ValidationPipe({ transform: true, whitelist: true })) createTransferDto: CreateTransferDto,
    @Request() req: any
  ): Promise<any> {
    try {
      this.logger.log(`Creating and funding Wise transfer for user ${req.user.id}`, {
        targetAccount: createTransferDto.targetAccount,
        quoteUuid: createTransferDto.quoteUuid,
        customerTransactionId: createTransferDto.customerTransactionId,
      });

      const result = await this.wiseService.createAndFundTransfer(createTransferDto);

      // Create admin notification
      await this.adminNotificationsService.createAdminNotification({
        title: 'Wise Transfer Created and Funded',
        message: `User ${req.user.email} created and funded Wise transfer: ${createTransferDto.customerTransactionId}`,
        type: AdminNotificationType.SUCCESS,
        priority: AdminNotificationPriority.MEDIUM,
        category: AdminNotificationCategory.PAYMENT,
      });

      return result;
    } catch (error) {
      this.logger.error(`Failed to create and fund Wise transfer for user ${req.user.id}:`, error);
      throw error;
    }
  }

  /**
   * Get transfer by ID
   */
  @Get('transfers/:id')
  @ApiOperation({ summary: 'Get Wise transfer by ID' })
  @ApiResponse({ status: 200, description: 'Transfer retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Transfer not found' })
  async getTransfer(
    @Param('id') transferId: string,
    @Request() req: any
  ): Promise<any> {
    try {
      this.logger.log(`Getting Wise transfer ${transferId} for user ${req.user.id}`);

      const transfer = await this.wiseService.getTransfer(transferId);

      return transfer;
    } catch (error) {
      this.logger.error(`Failed to get Wise transfer ${transferId} for user ${req.user.id}:`, error);
      throw error;
    }
  }

  /**
   * Cancel a transfer
   */
  @Put('transfers/:id/cancel')
  @ApiOperation({ summary: 'Cancel a Wise transfer' })
  @ApiResponse({ status: 200, description: 'Transfer cancelled successfully' })
  @ApiResponse({ status: 400, description: 'Cannot cancel transfer' })
  async cancelTransfer(
    @Param('id') transferId: string,
    @Request() req: any
  ): Promise<any> {
    try {
      this.logger.log(`Cancelling Wise transfer ${transferId} for user ${req.user.id}`);

      const transfer = await this.wiseService.cancelTransfer(transferId);

      // Create admin notification
      await this.adminNotificationsService.createAdminNotification({
        title: 'Wise Transfer Cancelled',
        message: `User ${req.user.email} cancelled Wise transfer ${transferId}`,
        type: AdminNotificationType.WARNING,
        priority: AdminNotificationPriority.MEDIUM,
        category: AdminNotificationCategory.PAYMENT,
      });

      return transfer;
    } catch (error) {
      this.logger.error(`Failed to cancel Wise transfer ${transferId} for user ${req.user.id}:`, error);
      throw error;
    }
  }

  /**
   * Get all profiles for the API key
   */
  @Get('profiles')
  @ApiOperation({ summary: 'Get all Wise profiles for the API key' })
  @ApiResponse({ status: 200, description: 'Profiles retrieved successfully' })
  async getProfiles(@Request() req: any): Promise<any> {
    try {
      this.logger.log(`Getting all Wise profiles for user ${req.user.id}`);

      const profiles = await this.wiseService.getProfiles();

      return profiles;
    } catch (error) {
      this.logger.error(`Failed to get Wise profiles for user ${req.user.id}:`, error);
      throw error;
    }
  }

  /**
   * Get profile information
   */
  @Get('profile')
  @ApiOperation({ summary: 'Get Wise profile information' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  async getProfile(@Request() req: any): Promise<any> {
    try {
      this.logger.log(`Getting Wise profile for user ${req.user.id}`);

      const profile = await this.wiseService.getProfile();

      return profile;
    } catch (error) {
      this.logger.error(`Failed to get Wise profile for user ${req.user.id}:`, error);
      throw error;
    }
  }

  /**
   * Get account balance
   */
  @Get('balance')
  @ApiOperation({ summary: 'Get Wise account balance' })
  @ApiResponse({ status: 200, description: 'Balance retrieved successfully' })
  async getAccountBalance(@Request() req: any): Promise<any> {
    try {
      this.logger.log(`Getting Wise account balance for user ${req.user.id}`);

      const balance = await this.wiseService.getAccountBalance();

      return balance;
    } catch (error) {
      this.logger.error(`Failed to get Wise account balance for user ${req.user.id}:`, error);
      throw error;
    }
  }

  /**
   * Get exchange rates
   */
  @Get('rates')
  @ApiOperation({ summary: 'Get Wise exchange rates' })
  @ApiResponse({ status: 200, description: 'Exchange rates retrieved successfully' })
  @ApiQuery({ name: 'source', required: true, type: String })
  @ApiQuery({ name: 'target', required: true, type: String })
  async getExchangeRates(
    @Query('source') sourceCurrency: string,
    @Query('target') targetCurrency: string,
    @Request() req: any
  ): Promise<any> {
    try {
      this.logger.log(`Getting Wise exchange rates for user ${req.user.id}`, {
        sourceCurrency,
        targetCurrency,
      });

      const rates = await this.wiseService.getExchangeRates(sourceCurrency, targetCurrency);

      return rates;
    } catch (error) {
      this.logger.error(`Failed to get Wise exchange rates for user ${req.user.id}:`, error);
      throw error;
    }
  }

  /**
   * Test connection to Wise API (admin only)
   */
  @Get('test-connection')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Test Wise API connection (admin only)' })
  @ApiResponse({ status: 200, description: 'Connection test successful' })
  @ApiResponse({ status: 503, description: 'Connection test failed' })
  async testConnection(@Request() req: any): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log(`Testing Wise API connection by admin ${req.user.id}`);

      const isConnected = await this.wiseService.testConnection();

      if (isConnected) {
        await this.adminNotificationsService.createAdminNotification({
          title: 'Wise API Connection Test Successful',
          message: `Admin ${req.user.email} successfully tested Wise API connection`,
          type: AdminNotificationType.SUCCESS,
          priority: AdminNotificationPriority.LOW,
          category: AdminNotificationCategory.PAYMENT,
        });

        return { success: true, message: 'Wise API connection test successful' };
      } else {
        await this.adminNotificationsService.createAdminNotification({
          title: 'Wise API Connection Test Failed',
          message: `Admin ${req.user.email} failed to connect to Wise API`,
          type: AdminNotificationType.ERROR,
          priority: AdminNotificationPriority.HIGH,
          category: AdminNotificationCategory.PAYMENT,
        });

        throw new InternalServerErrorException('Wise API connection test failed');
      }
    } catch (error) {
      this.logger.error(`Wise API connection test failed for admin ${req.user.id}:`, error);
      throw error;
    }
  }

  /**
   * Create test recipient with provided test bank details (admin only)
   */
  @Post('test-recipient')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Create test recipient with test bank details (admin only)' })
  @ApiResponse({ status: 201, description: 'Test recipient created successfully' })
  async createTestRecipient(@Request() req: any): Promise<any> {
    try {
      this.logger.log(`Creating test Wise recipient by admin ${req.user.id}`);

      const recipient = await this.wiseService.createTestRecipient();

      await this.adminNotificationsService.createAdminNotification({
        title: 'Wise Test Recipient Created',
        message: `Admin ${req.user.email} created a test Wise recipient`,
        type: AdminNotificationType.INFO,
        priority: AdminNotificationPriority.LOW,
        category: AdminNotificationCategory.PAYMENT,
      });

      return recipient;
    } catch (error) {
      this.logger.error(`Failed to create test Wise recipient for admin ${req.user.id}:`, error);
      throw error;
    }
  }

  /**
   * Validate bank details
   */
  private validateBankDetails(recipientDto: CreateRecipientDto): void {
    const { currency, type, details } = recipientDto;

    // Basic validation for different recipient types
    if (type === 'iban') {
      if (!details.iban) {
        throw new BadRequestException('IBAN is required for IBAN recipient type');
      }
      if (!this.validateIBAN(details.iban)) {
        throw new BadRequestException('Invalid IBAN format');
      }
      if (!details.bic) {
        throw new BadRequestException('BIC is required for IBAN recipient type');
      }
    } else if (type === 'sort_code') {
      if (!details.sortCode || !details.accountNumber) {
        throw new BadRequestException('Sort code and account number are required for UK bank transfer');
      }
    } else if (type === 'bank_account') {
      if (!details.accountNumber || !details.routingNumber) {
        throw new BadRequestException('Account number and routing number are required for US bank transfer');
      }
    }

    // Currency validation
    const supportedCurrencies = ['gbp', 'eur', 'usd', 'cad', 'aud'];
    if (!supportedCurrencies.includes(currency.toLowerCase())) {
      throw new BadRequestException(`Currency ${currency} is not supported`);
    }
  }

  /**
   * Validate IBAN format (basic validation)
   */
  private validateIBAN(iban: string): boolean {
    // Basic IBAN validation - remove spaces and check length
    const cleanIBAN = iban.replace(/\s/g, '').toUpperCase();
    
    if (cleanIBAN.length < 15 || cleanIBAN.length > 34) {
      return false;
    }

    // Check country code (first 2 characters)
    const countryCode = cleanIBAN.substring(0, 2);
    const countryCodes = ['GB', 'FR', 'DE', 'IT', 'ES', 'NL', 'BE', 'AT', 'SE', 'DK', 'NO', 'FI', 'IE', 'PT', 'CH'];
    
    if (!countryCodes.includes(countryCode)) {
      return false;
    }

    return true;
  }
}