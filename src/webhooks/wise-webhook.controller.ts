import {
  Controller,
  Post,
  Body,
  Headers,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WiseWebhookService } from '../wallets/wise-webhook-enhanced.service';
import { Transaction } from '../transactions/entities/transaction.entity';
import { TransactionStatus } from '../transactions/enums/transaction-status.enum';

@ApiTags('webhooks')
@Controller('webhooks/wise')
export class WiseWebhookController {
  private readonly logger = new Logger(WiseWebhookController.name);

  constructor(
    private readonly wiseWebhookService: WiseWebhookService,
    @InjectRepository(Transaction)
    private readonly transactionsRepository: Repository<Transaction>,
  ) {}

  @Post()
  async handleWiseWebhook(
    @Body() payload: any,
    @Headers('x-signature-sha256') signature: string,
  ) {
    try {
      this.logger.log(`Received Wise webhook: ${payload?.event_type}`);

      const result = await this.wiseWebhookService.processWebhook(payload);

      this.logger.log(
        `Wise webhook processed: ${result.status} - ${result.message}`,
      );
      return result;
    } catch (error) {
      this.logger.error(`Failed to process Wise webhook:`, error);
      throw new BadRequestException('Webhook processing failed');
    }
  }
}
