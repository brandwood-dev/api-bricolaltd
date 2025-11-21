import { 
  Controller, 
  Post, 
  Req,
  Headers, 
  Logger, 
  BadRequestException,
  UseGuards,
  HttpCode,
  HttpStatus,
  Ip,
  UseInterceptors,
  ClassSerializerInterceptor
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { Request } from 'express';
import { EnhancedStripeWebhookService, WebhookProcessingResult } from './enhanced-stripe-webhook.service';
import { StripeWebhookGuard } from './guards/stripe-webhook.guard';
import { WebhookRateLimitService } from './services/webhook-rate-limit.service';
import { WebhookEventService } from './services/webhook-event.service';

@ApiTags('webhooks')
@Controller('webhooks')
@UseInterceptors(ClassSerializerInterceptor)
export class EnhancedStripeWebhookController {
  private readonly logger = new Logger(EnhancedStripeWebhookController.name);

  constructor(
    private readonly enhancedStripeWebhookService: EnhancedStripeWebhookService,
    private readonly webhookRateLimitService: WebhookRateLimitService,
    private readonly webhookEventService: WebhookEventService,
  ) {}

  @Post('stripe/enhanced')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StripeWebhookGuard)
  @ApiOperation({ 
    summary: 'Enhanced secure endpoint for Stripe webhooks',
    description: 'Processes Stripe webhook events with comprehensive security, deduplication, and error handling'
  })
  @ApiHeader({
    name: 'Stripe-Signature',
    description: 'Stripe webhook signature for verification',
    required: true,
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Webhook processed successfully',
    type: Object
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Bad request - Invalid signature, rate limit exceeded, or processing error',
    type: Object
  })
  @ApiResponse({ 
    status: 429, 
    description: 'Too many requests - Rate limit exceeded',
    type: Object
  })
  async handleStripeWebhookEnhanced(
    @Req() req: Request & { stripeEvent?: any },
    @Headers('stripe-signature') signature: string,
    @Headers('user-agent') userAgent: string,
    @Ip() ipAddress: string
  ): Promise<WebhookProcessingResult> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();
    
    this.logger.log(`[${requestId}] Processing enhanced Stripe webhook`, {
      ipAddress,
      userAgent: userAgent?.substring(0, 100), // Limit user agent length
      signature: signature?.substring(0, 10) + '...', // Log partial signature
      eventType: req.stripeEvent?.type,
      eventId: req.stripeEvent?.id,
    });

    try {
      // Check rate limits
      const rateLimitResult = await this.webhookRateLimitService.isWithinRateLimits(
        ipAddress,
        req.stripeEvent?.type
      );

      if (!rateLimitResult.allowed) {
        this.logger.warn(`[${requestId}] Rate limit exceeded`, {
          ipAddress,
          reason: rateLimitResult.reason,
          eventType: req.stripeEvent?.type,
        });

        throw new BadRequestException({
          success: false,
          error: 'Rate limit exceeded',
          message: rateLimitResult.reason,
          retryAfter: 60, // seconds
        });
      }

      // Validate event consistency
      if (!this.webhookEventService.validateEventConsistency(req.stripeEvent)) {
        this.logger.warn(`[${requestId}] Event consistency validation failed`, {
          eventId: req.stripeEvent?.id,
          eventType: req.stripeEvent?.type,
        });

        throw new BadRequestException({
          success: false,
          error: 'Event validation failed',
          message: 'Invalid event structure or timestamp',
        });
      }

      // Process the webhook with comprehensive error handling
      const result = await this.enhancedStripeWebhookService.processWebhook(
        req.stripeEvent,
        ipAddress,
        userAgent
      );

      const processingTime = Date.now() - startTime;
      
      this.logger.log(`[${requestId}] Webhook processed successfully in ${processingTime}ms`, {
        eventType: result.eventType,
        eventId: result.eventId,
        isDuplicate: result.isDuplicate,
        processingTime,
      });

      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      this.logger.error(`[${requestId}] Webhook processing failed after ${processingTime}ms`, {
        error: error.message,
        stack: error.stack,
        ipAddress,
        eventType: req.stripeEvent?.type,
        eventId: req.stripeEvent?.id,
        processingTime,
      });

      // Re-throw for proper HTTP response
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException({
        success: false,
        error: 'Webhook processing failed',
        message: error.message || 'Internal processing error',
        requestId,
      });
    }
  }

  @Post('stripe/health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook health check and rate limit status' })
  @ApiResponse({ status: 200, description: 'Health status retrieved successfully' })
  async getWebhookHealth(
    @Ip() ipAddress: string,
    @Headers('stripe-signature') signature?: string
  ): Promise<{
    status: string;
    timestamp: string;
    rateLimits: any;
    signatureValid: boolean;
  }> {
    try {
      // Check if signature is valid (basic check)
      let signatureValid = false;
      if (signature) {
        try {
          // This is a basic validation - in production, you'd want full validation
          signatureValid = signature.startsWith('t=') && signature.includes(',v1=');
        } catch (error) {
          this.logger.warn('Signature validation error:', error.message);
        }
      }

      // Get rate limit status
      const rateLimits = this.webhookRateLimitService.getRateLimitStatus(ipAddress);

      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        rateLimits,
        signatureValid,
      };

    } catch (error) {
      this.logger.error('Health check failed:', error);
      
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        rateLimits: {},
        signatureValid: false,
      };
    }
  }

  /**
   * Generate a unique request ID for tracking
   */
  private generateRequestId(): string {
    return `wh_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Cleanup method for testing
   */
  async cleanup(): Promise<void> {
    this.logger.log('Cleaning up webhook services');
    
    try {
      // Cleanup expired rate limit entries
      this.webhookRateLimitService.cleanupExpiredEntries();
      
      // Cleanup old webhook events
      await this.webhookEventService.cleanupOldEvents();
      
      this.logger.log('Webhook cleanup completed');
    } catch (error) {
      this.logger.error('Error during webhook cleanup:', error);
    }
  }
}