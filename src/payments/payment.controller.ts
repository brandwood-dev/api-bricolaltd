import { 
  Controller, 
  Post, 
  Body, 
  Param, 
  Get, 
  UseGuards, 
  Request,
  BadRequestException 
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { ConfirmPaymentIntentDto } from './dto/confirm-payment-intent.dto';

@ApiTags('payments')
@Controller('payments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('intent')
  @ApiOperation({ summary: 'Créer un Payment Intent pour bloquer les fonds' })
  @ApiResponse({ status: 201, description: 'Payment Intent créé avec succès' })
  async createPaymentIntent(
    @Body() createPaymentIntentDto: CreatePaymentIntentDto,
    @Request() req: any
  ) {
    try {
      const { amount, currency, bookingId } = createPaymentIntentDto;
      
      const metadata = {
        user_id: req.user.id,
        booking_id: bookingId,
        type: 'booking_hold'
      };

      const paymentIntent = await this.paymentService.createPaymentIntent({
        amount,
        currency,
        metadata
      });

      return {
        success: true,
        data: {
          client_secret: paymentIntent.client_secret,
          payment_intent_id: paymentIntent.id,
          amount: paymentIntent.amount / 100,
          currency: paymentIntent.currency
        }
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Post('intent/:id/confirm')
  @ApiOperation({ summary: 'Confirmer un Payment Intent' })
  @ApiResponse({ status: 200, description: 'Payment Intent confirmé avec succès' })
  async confirmPaymentIntent(
    @Param('id') paymentIntentId: string,
    @Body() confirmPaymentIntentDto: ConfirmPaymentIntentDto
  ) {
    try {
      const { paymentMethodId } = confirmPaymentIntentDto;
      
      const paymentIntent = await this.paymentService.confirmPaymentIntent(
        paymentIntentId,
        paymentMethodId
      );

      return {
        success: true,
        data: {
          status: paymentIntent.status,
          payment_intent_id: paymentIntent.id
        }
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Post('intent/:id/capture')
  @ApiOperation({ summary: 'Capturer les fonds d\'un Payment Intent' })
  @ApiResponse({ status: 200, description: 'Fonds capturés avec succès' })
  async capturePaymentIntent(
    @Param('id') paymentIntentId: string,
    @Body() body: { amount?: number }
  ) {
    try {
      const paymentIntent = await this.paymentService.capturePaymentIntent(
        paymentIntentId,
        body.amount
      );

      // Mettre à jour la transaction
      await this.paymentService.updateTransactionStatus(
        paymentIntentId,
        'completed' as any,
        new Date()
      );

      return {
        success: true,
        data: {
          status: paymentIntent.status,
          amount_captured: paymentIntent.amount_received / 100
        }
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Post('intent/:id/cancel')
  @ApiOperation({ summary: 'Annuler un Payment Intent' })
  @ApiResponse({ status: 200, description: 'Payment Intent annulé avec succès' })
  async cancelPaymentIntent(@Param('id') paymentIntentId: string) {
    try {
      const paymentIntent = await this.paymentService.cancelPaymentIntent(paymentIntentId);

      // Mettre à jour la transaction
      await this.paymentService.updateTransactionStatus(
        paymentIntentId,
        'cancelled' as any,
        new Date()
      );

      return {
        success: true,
        data: {
          status: paymentIntent.status,
          payment_intent_id: paymentIntent.id
        }
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Post('refund')
  @ApiOperation({ summary: 'Créer un remboursement' })
  @ApiResponse({ status: 201, description: 'Remboursement créé avec succès' })
  async createRefund(
    @Body() body: { paymentIntentId: string; amount?: number; reason?: string }
  ) {
    try {
      const { paymentIntentId, amount, reason } = body;
      
      const refund = await this.paymentService.createRefund(
        paymentIntentId,
        amount,
        reason
      );

      return {
        success: true,
        data: {
          refund_id: refund.id,
          amount: refund.amount / 100,
          status: refund.status
        }
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get('intent/:id')
  @ApiOperation({ summary: 'Récupérer les détails d\'un Payment Intent' })
  @ApiResponse({ status: 200, description: 'Détails du Payment Intent' })
  async getPaymentIntent(@Param('id') paymentIntentId: string) {
    try {
      const paymentIntent = await this.paymentService.getPaymentIntent(paymentIntentId);

      return {
        success: true,
        data: {
          id: paymentIntent.id,
          amount: paymentIntent.amount / 100,
          currency: paymentIntent.currency,
          status: paymentIntent.status,
          capture_method: paymentIntent.capture_method,
          metadata: paymentIntent.metadata
        }
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Post('booking/:bookingId/hold')
  @ApiOperation({ summary: 'Bloquer les fonds pour une réservation' })
  @ApiResponse({ status: 201, description: 'Fonds bloqués avec succès' })
  async holdFundsForBooking(
    @Param('bookingId') bookingId: string,
    @Body() body: { amount: number; currency?: string },
    @Request() req: any
  ) {
    try {
      const { amount, currency = 'gbp' } = body;
      
      const result = await this.paymentService.holdFundsForBooking(
        req.user.id,
        amount,
        bookingId,
        currency
      );

      return {
        success: true,
        data: {
          client_secret: result.paymentIntent.client_secret,
          payment_intent_id: result.paymentIntent.id,
          transaction_id: result.transaction.id,
          amount: amount,
          currency: currency
        }
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Post('booking/capture/:paymentIntentId')
  @ApiOperation({ summary: 'Capturer les fonds pour finaliser une réservation' })
  @ApiResponse({ status: 200, description: 'Fonds capturés pour la réservation' })
  async captureFundsForBooking(
    @Param('paymentIntentId') paymentIntentId: string,
    @Body() body: { amount?: number }
  ) {
    try {
      const result = await this.paymentService.captureFundsForBooking(
        paymentIntentId,
        body.amount
      );

      return {
        success: true,
        data: {
          payment_intent_status: result.paymentIntent.status,
          transaction_status: result.transaction.status,
          amount_captured: result.paymentIntent.amount_received / 100
        }
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Post('booking/release/:paymentIntentId')
  @ApiOperation({ summary: 'Libérer les fonds bloqués (annulation de réservation)' })
  @ApiResponse({ status: 200, description: 'Fonds libérés avec succès' })
  async releaseFundsForBooking(@Param('paymentIntentId') paymentIntentId: string) {
    try {
      const result = await this.paymentService.releaseFundsForBooking(paymentIntentId);

      return {
        success: true,
        data: {
          payment_intent_status: result.paymentIntent.status,
          transaction_status: result.transaction.status
        }
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}