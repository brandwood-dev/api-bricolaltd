import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeWebhookGuard implements CanActivate {
  private readonly logger = new Logger(StripeWebhookGuard.name);
  private stripe: Stripe;

  constructor(private configService: ConfigService) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-02-24.acacia',
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const signature = request.headers['stripe-signature'];
    const rawBody = request.rawBody;

    if (!signature) {
      this.logger.error('Missing Stripe signature');
      throw new BadRequestException('Missing Stripe signature');
    }

    if (!rawBody) {
      this.logger.error('Missing raw body');
      throw new BadRequestException('Missing raw body');
    }

    try {
      // Verify the webhook signature
      const webhookSecret = this.configService.get<string>(
        'STRIPE_WEBHOOK_SECRET',
      );
      if (!webhookSecret) {
        throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
      }

      const event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret,
      );

      // Validate the event structure
      this.validateEventStructure(event);

      // Add the verified event to the request for later use
      request.stripeEvent = event;

      this.logger.log(
        `Webhook signature verified for event: ${event.type} - ${event.id}`,
      );
      return true;
    } catch (error) {
      this.logger.error('Webhook signature verification failed:', {
        signature: signature?.substring(0, 10) + '...',
        bodyLength: rawBody?.length,
        error: error.message,
      });

      throw new BadRequestException('Invalid webhook signature');
    }
  }

  private validateEventStructure(event: Stripe.Event): void {
    if (!event.id || !event.type || !event.data) {
      throw new BadRequestException('Invalid event structure');
    }

    // Validate event ID format
    if (!event.id.startsWith('evt_')) {
      throw new BadRequestException('Invalid event ID format');
    }

    // Validate event type
    const validEventTypes = [
      'payment_intent.succeeded',
      'payment_intent.payment_failed',
      'payment_intent.canceled',
      'payment_intent.created',
      'payment_intent.processing',
      'payment_intent.requires_action',
      'charge.succeeded',
      'charge.failed',
      'charge.captured',
      'charge.refunded',
      'charge.updated',
      'charge.pending',
      'charge.expired',
      'charge.dispute.created',
      'charge.dispute.updated',
      'charge.dispute.closed',
      'charge.dispute.funds_withdrawn',
      'charge.dispute.funds_reinstated',
      'invoice.payment_succeeded',
      'invoice.payment_failed',
      'transfer.created',
      'transfer.failed',
      'transfer.paid',
      'transfer.reversed',
      'payout.created',
      'payout.failed',
      'payout.paid',
      'payout.updated',
      'account.updated',
      'account.application.authorized',
      'account.application.deauthorized',
    ];

    if (!validEventTypes.includes(event.type)) {
      this.logger.warn(`Unknown event type: ${event.type}`);
      // Don't throw here - allow unknown events but log them
    }

    // Validate timestamp
    if (
      event.created &&
      (typeof event.created !== 'number' || event.created < 0)
    ) {
      throw new BadRequestException('Invalid event timestamp');
    }

    // Validate API version
    if (event.api_version && !event.api_version.startsWith('20')) {
      this.logger.warn(`Unexpected API version: ${event.api_version}`);
    }
  }
}
