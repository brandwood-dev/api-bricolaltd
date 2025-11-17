import { Controller, Post, Body, Headers, BadRequestException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WiseWebhookService } from './wise-webhook.service';
import { Transaction } from '../transactions/entities/transaction.entity';
import { TransactionStatus } from '../transactions/enums/transaction-status.enum';

@ApiTags('webhooks')
@Controller('webhooks/wise')
export class WiseWebhookController {
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
    const valid = this.wiseWebhookService.validateSignature(payload, signature);
    if (!valid) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const eventType = payload?.event_type;
    const resource = payload?.data?.resource;
    const wiseTransferId = resource?.id;
    const wiseStatus = resource?.status;

    if (!wiseTransferId) return { status: 'ignored' };

    const tx = await this.transactionsRepository.findOne({
      where: [{ externalReference: String(wiseTransferId) }, { wizeTransferId: String(wiseTransferId) }],
    });

    if (!tx) return { status: 'not_found' };

    tx.wizeStatus = wiseStatus;
    tx.wizeResponse = payload;

    if (eventType === 'transfer.state-change') {
      if (wiseStatus === 'outgoing_payment_sent' || wiseStatus === 'completed') {
        tx.status = TransactionStatus.COMPLETED;
        tx.processedAt = new Date();
      } else if (wiseStatus === 'processing') {
        tx.status = TransactionStatus.PROCESSING;
      }
    }

    if (eventType === 'transfer.payout-failure') {
      tx.status = TransactionStatus.FAILED;
    }

    await this.transactionsRepository.save(tx);
    return { status: 'ok' };
  }
}