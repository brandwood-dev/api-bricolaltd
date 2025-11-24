import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosError } from 'axios';
import * as crypto from 'crypto';

// Wise API Types
interface WiseQuote {
  id: string;
  sourceCurrency: string;
  targetCurrency: string;
  sourceAmount: number;
  targetAmount: number;
  rate: number;
  createdTime: string;
  expirationTime: string;
  payOut: string;
  status: 'PENDING' | 'COMPLETED' | 'EXPIRED';
}

interface WiseRecipient {
  id: string;
  profile: string;
  accountHolderName: string;
  currency: string;
  country: string;
  type: string;
  details: Record<string, any>;
}

interface WiseTransfer {
  id: string;
  user: string;
  targetAccount: string;
  quote: string;
  status:
    | 'incoming_payment_waiting'
    | 'processing'
    | 'funds_converted'
    | 'outgoing_payment_sent'
    | 'completed'
    | 'cancelled';
  reference: string;
  rate: number;
  created: string;
  customerTransactionId: string;
}

interface WiseWebhookPayload {
  data: {
    resource: {
      id: string;
      type: string;
      status: string;
      [key: string]: any;
    };
  };
  event_type: string;
  event_time: string;
}

export interface WiseTransferRequest {
  targetAccount: string;
  quoteUuid: string;
  customerTransactionId: string;
  reference?: string;
  transferPurpose?: string;
  sourceOfFunds?: string;
}

export interface WiseQuoteRequest {
  sourceCurrency: string;
  targetCurrency: string;
  sourceAmount?: number;
  targetAmount?: number;
  profile: number;
  payOut?: 'BALANCE' | 'BANK_TRANSFER';
}

export interface WiseRecipientRequest {
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

@Injectable()
export class WiseService {
  private readonly logger = new Logger(WiseService.name);
  private client: AxiosInstance;
  private apiUrl: string;
  private apiKey: string;
  private profileId: number;
  private webhookSecret: string;

  constructor(private readonly configService: ConfigService) {
    const configuredUrl = this.configService.get<string>('WISE_API_URL');
    const environment = (
      this.configService.get<string>('WISE_ENVIRONMENT') || 'live'
    ).toLowerCase();
    this.apiUrl =
      configuredUrl ||
      (environment === 'sandbox'
        ? 'https://api.sandbox.transferwise.com'
        : 'https://api.wise.com');
    this.apiKey = this.configService.get<string>('WISE_API_KEY') || '';
    const profileRaw = this.configService.get<string>('WISE_PROFILE_ID') || '';
    this.profileId = parseInt(profileRaw.trim(), 10);
    this.webhookSecret =
      this.configService.get<string>('WISE_WEBHOOK_SECRET') || '';

    if (!this.apiKey) {
      throw new Error('WISE_API_KEY is not configured');
    }
    if (!this.profileId) {
      throw new Error('WISE_PROFILE_ID is not configured or invalid');
    }

    this.client = axios.create({
      baseURL: this.apiUrl,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 second timeout for financial operations
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use((config) => {
      this.logger.log(
        `Wise API Request: ${config.method?.toUpperCase()} ${config.url}`,
      );
      return config;
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        this.logger.log(
          `Wise API Response: ${response.status} ${response.config.url}`,
        );
        return response;
      },
      (error: AxiosError) => {
        this.handleApiError(error);
        return Promise.reject(error);
      },
    );
  }

  private detectCurrencyFromIban(iban?: string): string {
    const cc = (iban || '').trim().slice(0, 2).toUpperCase();
    const map: Record<string, string> = {
      GB: 'GBP',
      FR: 'EUR',
      DE: 'EUR',
      ES: 'EUR',
      IT: 'EUR',
      NL: 'EUR',
      BE: 'EUR',
      PT: 'EUR',
      IE: 'EUR',
      AT: 'EUR',
      AE: 'AED',
      SA: 'SAR',
      QA: 'QAR',
      KW: 'KWD',
      BH: 'BHD',
      OM: 'OMR',
    };
    return map[cc] || 'GBP';
  }

  /**
   * Create a quote for currency conversion and transfer
   */
  async createQuote(params: WiseQuoteRequest): Promise<WiseQuote> {
    try {
      this.logger.log(
        `Creating quote: ${params.sourceCurrency} → ${params.targetCurrency}`,
      );
      this.logger.log(`Quote profile (service): ${this.profileId}`);

      const response = await this.client.post(
        `/v3/profiles/${this.profileId}/quotes`,
        {
          source: params.sourceCurrency,
          target: params.targetCurrency,
          rateType: 'FIXED',
          sourceAmount: params.sourceAmount,
          targetAmount: params.targetAmount,
          payOut: params.payOut || 'BANK_TRANSFER',
        },
      );

      this.logger.log(
        `Quote created with ID: ${response.data.id}, profile: ${response.data.profile}`,
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to create quote: ${error.message}`);
      throw new InternalServerErrorException('Failed to create Wise quote');
    }
  }

  /**
   * Get quote by ID
   */
  async getQuote(quoteId: string): Promise<WiseQuote> {
    try {
      const response = await this.client.get(`/v3/quotes/${quoteId}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get quote ${quoteId}: ${error.message}`);
      throw new InternalServerErrorException('Failed to get Wise quote');
    }
  }

  /**
   * Create a recipient account for transfers
   */
  async createRecipientAccount(
    params: WiseRecipientRequest,
  ): Promise<WiseRecipient> {
    try {
      this.logger.log(
        `Creating recipient account for ${params.accountHolderName}`,
      );

      const response = await this.client.post('/v1/accounts', {
        profile: this.profileId,
        accountHolderName: params.accountHolderName,
        currency: params.currency,
        type: params.type,
        details: params.details,
      });

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to create recipient account: ${error.message}`);
      throw new InternalServerErrorException(
        'Failed to create Wise recipient account',
      );
    }
  }

  /**
   * Get recipient account by ID
   */
  async getRecipientAccount(recipientId: string): Promise<WiseRecipient> {
    try {
      const response = await this.client.get(`/v1/accounts/${recipientId}`);
      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to get recipient account ${recipientId}: ${error.message}`,
      );
      throw new InternalServerErrorException(
        'Failed to get Wise recipient account',
      );
    }
  }

  /**
   * List recipient accounts
   */
  async listRecipientAccounts(currency?: string): Promise<WiseRecipient[]> {
    try {
      const params = currency ? { currency } : {};
      const response = await this.client.get('/v1/accounts', { params });
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to list recipient accounts: ${error.message}`);
      throw new InternalServerErrorException(
        'Failed to list Wise recipient accounts',
      );
    }
  }

  /**
   * Create a transfer
   */
  async createTransfer(params: WiseTransferRequest): Promise<WiseTransfer> {
    try {
      this.logger.log(`Creating transfer for quote ${params.quoteUuid}`);
      this.logger.log(`Transfer profile (service): ${this.profileId}`);

      const response = await this.client.post('/v1/transfers', {
        profile: this.profileId,
        targetAccount: params.targetAccount,
        quoteUuid: params.quoteUuid,
        customerTransactionId: params.customerTransactionId,
        reference: params.reference || `Transfer-${Date.now()}`,
        transferPurpose:
          params.transferPurpose || 'verification.transfers.purpose.pay.bills',
        sourceOfFunds:
          params.sourceOfFunds || 'verification.source.of.funds.other',
      });

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to create transfer: ${error.message}`);
      throw new InternalServerErrorException('Failed to create Wise transfer');
    }
  }

  /**
   * Fund a transfer (complete the transfer)
   */
  async fundTransfer(
    transferId: string,
    fundingData: { type: 'BALANCE' | 'CARD' },
  ): Promise<any> {
    try {
      this.logger.log(`Funding transfer ${transferId}`);

      const response = await this.client.post(
        `/v3/profiles/${this.profileId}/transfers/${transferId}/payments`,
        fundingData,
      );
      return response.data;
    } catch (error: any) {
      this.logger.error(
        `Failed to fund transfer ${transferId}: ${error.message}`,
      );

      // Handle specific permission/balance issues
      if (error.response?.status === 403) {
        this.logger.warn(
          `Funding permission denied for transfer ${transferId}. This may indicate insufficient balance or API key restrictions.`,
        );
        throw new Error(
          `Transfer funding denied. This may indicate insufficient balance or API key restrictions. Transfer ID: ${transferId}`,
        );
      }

      throw new InternalServerErrorException('Failed to fund Wise transfer');
    }
  }

  /**
   * Create and fund transfer in one operation
   */
  async createAndFundTransfer(params: WiseTransferRequest): Promise<any> {
    try {
      this.logger.log(`Creating and funding transfer`);

      // Create the transfer
      const transfer = await this.createTransfer(params);

      // Fund the transfer using balance
      const payment = await this.fundTransfer(transfer.id, { type: 'BALANCE' });

      return {
        transfer,
        payment,
      };
    } catch (error) {
      this.logger.error(`Failed to create and fund transfer: ${error.message}`);
      throw new InternalServerErrorException(
        'Failed to create and fund Wise transfer',
      );
    }
  }

  /**
   * Get transfer by ID
   */
  async getTransfer(transferId: string): Promise<WiseTransfer> {
    try {
      const response = await this.client.get(`/v1/transfers/${transferId}`);
      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to get transfer ${transferId}: ${error.message}`,
      );
      throw new InternalServerErrorException('Failed to get Wise transfer');
    }
  }

  /**
   * Cancel a transfer
   */
  async cancelTransfer(transferId: string): Promise<WiseTransfer> {
    try {
      this.logger.log(`Cancelling transfer ${transferId}`);

      const response = await this.client.put(
        `/v1/transfers/${transferId}/cancel`,
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to cancel transfer ${transferId}: ${error.message}`,
      );
      throw new InternalServerErrorException('Failed to cancel Wise transfer');
    }
  }

  /**
   * Get all profiles for the API key
   */
  async getProfiles(): Promise<any> {
    try {
      this.logger.log('Getting all Wise profiles for API key');
      const response = await this.client.get('/v1/profiles');
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get profiles: ${error.message}`);
      throw new InternalServerErrorException('Failed to get Wise profiles');
    }
  }

  /**
   * Get profile information
   */
  async getProfile(): Promise<any> {
    try {
      const response = await this.client.get(`/v1/profiles/${this.profileId}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get profile: ${error.message}`);
      throw new InternalServerErrorException('Failed to get Wise profile');
    }
  }

  /**
   * Get account balance
   */
  async getAccountBalance(): Promise<any> {
    try {
      const response = await this.client.get(
        `/v1/profiles/${this.profileId}/balances`,
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get account balance: ${error.message}`);
      throw new InternalServerErrorException(
        'Failed to get Wise account balance',
      );
    }
  }

  /**
   * Get exchange rates
   */
  async getExchangeRates(
    sourceCurrency: string,
    targetCurrency: string,
  ): Promise<any> {
    try {
      const response = await this.client.get('/v1/rates', {
        params: {
          source: sourceCurrency,
          target: targetCurrency,
        },
      });
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get exchange rates: ${error.message}`);
      throw new InternalServerErrorException(
        'Failed to get Wise exchange rates',
      );
    }
  }

  /**
   * Validate webhook signature
   */
  validateWebhookSignature(payload: any, signature: string): boolean {
    if (!this.webhookSecret) {
      this.logger.warn(
        'WISE_WEBHOOK_SECRET not configured, skipping validation',
      );
      return true;
    }

    try {
      const payloadString = JSON.stringify(payload);
      const computedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(payloadString)
        .digest('hex');

      const isValid = computedSignature === signature;

      if (!isValid) {
        this.logger.error('Invalid webhook signature', {
          computed: computedSignature,
          provided: signature,
        });
      }

      return isValid;
    } catch (error) {
      this.logger.error(
        `Failed to validate webhook signature: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Handle API errors
   */
  private handleApiError(error: any): void {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      this.logger.error(`Wise API Error ${status}:`, {
        status,
        data,
        url: error.config?.url,
        method: error.config?.method,
      });

      if (status === 400) {
        throw new BadRequestException('Invalid request to Wise API');
      } else if (status === 401) {
        throw new InternalServerErrorException(
          'Wise API authentication failed',
        );
      } else if (status === 403) {
        throw new InternalServerErrorException('Wise API access denied');
      } else if (status === 404) {
        throw new InternalServerErrorException('Wise resource not found');
      } else if (status >= 500) {
        throw new InternalServerErrorException('Wise API server error');
      }
    } else if (error.request) {
      this.logger.error('Wise API request failed:', error.message);
      throw new InternalServerErrorException('Wise API request failed');
    } else {
      this.logger.error('Wise API configuration error:', error.message);
      throw new InternalServerErrorException('Wise API configuration error');
    }
  }

  /**
   * Test connection to Wise API
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getProfile();
      this.logger.log('Wise API connection test successful');
      return true;
    } catch (error) {
      this.logger.error('Wise API connection test failed:', error.message);
      return false;
    }
  }

  /**
   * Create a test recipient with provided test bank details
   */
  async createTestRecipient(): Promise<WiseRecipient> {
    return this.createRecipientAccount({
      currency: 'EUR',
      type: 'iban',
      profile: this.profileId,
      accountHolderName: 'Test Account',
      details: {
        iban: 'FR7640618804300004056718219',
        bic: 'BOUSFRPPXXX',
      },
    });
  }
}
