import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class WiseService {
  private readonly logger = new Logger(WiseService.name);
  private client: AxiosInstance;
  private apiUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.apiUrl = this.configService.get<string>('WISE_API_URL') || 'https://api.wise.com';
    const token = this.configService.get<string>('WISE_API_TOKEN');
    this.client = axios.create({
      baseURL: this.apiUrl,
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });
  }

  async createQuote(params: {
    sourceCurrency: string;
    targetCurrency: string;
    sourceAmount?: number;
    targetAmount?: number;
    profile: number | string;
    payOut?: 'BALANCE';
  }): Promise<any> {
    const res = await this.client.post('/v2/quotes', params);
    return res.data;
  }

  async createRecipientAccount(params: {
    currency: string;
    type: string;
    profile: number | string;
    accountHolderName: string;
    details: Record<string, any>;
  }): Promise<any> {
    const res = await this.client.post('/v1/accounts', params);
    return res.data;
  }

  async createTransfer(params: {
    targetAccount: string | number;
    quoteUuid: string;
    customerTransactionId: string;
    details: {
      reference: string;
      transferPurpose: string;
      sourceOfFunds: string;
    };
  }): Promise<any> {
    const res = await this.client.post('/v1/transfers', params);
    return res.data;
  }

  async fundTransfer(transferId: string | number, fundingData: { type: 'BALANCE' }): Promise<any> {
    const res = await this.client.post(`/v1/transfers/${transferId}/payments`, fundingData);
    return res.data;
  }

  async createAndFundTransfer(params: {
    targetAccount: string | number;
    quoteUuid: string;
    customerTransactionId: string;
    details: {
      reference: string;
      transferPurpose: string;
      sourceOfFunds: string;
    };
  }): Promise<any> {
    const transfer = await this.createTransfer(params);
    const payment = await this.fundTransfer(transfer.id, { type: 'BALANCE' });
    return { ...transfer, payment };
  }

  async getTransfer(transferId: string | number): Promise<any> {
    const res = await this.client.get(`/v1/transfers/${transferId}`);
    return res.data;
  }

  validateWebhookSignature(payload: any, signature: string): boolean {
    const secret = this.configService.get<string>('WISE_WEBHOOK_SECRET') || '';
    try {
      const crypto = require('crypto');
      const computed = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');
      return computed === signature;
    } catch (e) {
      this.logger.warn('Failed to validate Wise webhook signature');
      return false;
    }
  }
}