import { 
  Controller, 
  Post, 
  Body, 
  Headers, 
  Logger, 
  BadRequestException,
  Req
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { StripeWebhookService } from './stripe-webhook.service';
import { Request } from 'express';

@ApiTags('webhooks')
@Controller('webhooks')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(private readonly stripeWebhookService: StripeWebhookService) {}

  @Post('stripe')
  @ApiOperation({ summary: 'Endpoint pour recevoir les webhooks Stripe' })
  @ApiResponse({ status: 200, description: 'Webhook traité avec succès' })
  @ApiResponse({ status: 400, description: 'Erreur de signature ou de traitement' })
  async handleStripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string
  ) {
    if (!signature) {
      this.logger.error('Signature Stripe manquante');
      throw new BadRequestException('Signature Stripe manquante');
    }

    try {
      // Récupérer le body brut de la requête
      const rawBody = req.rawBody || req.body;
      
      if (!rawBody) {
        throw new BadRequestException('Corps de la requête manquant');
      }

      // Traiter le webhook
      const result = await this.stripeWebhookService.handleWebhook(rawBody, signature);
      
      this.logger.log(`Webhook Stripe traité avec succès: ${result.eventType}`);
      
      return {
        success: true,
        message: 'Webhook traité avec succès',
        eventType: result.eventType,
        eventId: result.eventId
      };

    } catch (error) {
      this.logger.error('Erreur lors du traitement du webhook Stripe:', error);
      
      if (error.message.includes('signature')) {
        throw new BadRequestException('Signature Stripe invalide');
      }
      
      throw new BadRequestException(`Erreur de traitement du webhook: ${error.message}`);
    }
  }
}