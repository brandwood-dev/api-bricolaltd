import { Injectable } from '@nestjs/common';
import { WiseService } from '../wallets/wise.service';

@Injectable()
export class WiseWebhookService {
  constructor(private readonly wiseService: WiseService) {}

  validateSignature(payload: any, signature: string): boolean {
    return this.wiseService.validateWebhookSignature(payload, signature);
  }
}
