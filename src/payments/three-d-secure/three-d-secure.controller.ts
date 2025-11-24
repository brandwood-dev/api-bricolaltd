import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { ThreeDSecureService } from './three-d-secure.service';
import {
  InitializeThreeDSecureDto,
  CompleteThreeDSecureChallengeDto,
  ThreeDSecureResultDto,
  ThreeDSecureStatsDto,
} from './dto/three-ds-secure.dto';
import { ThreeDSStatus } from './enums/three-ds-status.enum';
import { ThreeDSError } from './enums/three-ds-error.enum';

@ApiTags('3ds')
@Controller('3ds')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ThreeDSecureController {
  private readonly logger = new Logger(ThreeDSecureController.name);

  constructor(private readonly threeDSecureService: ThreeDSecureService) {}

  /**
   * Initialize 3D Secure authentication
   */
  @Post('initialize')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Initialize 3D Secure authentication',
    description: 'Start 3D Secure authentication process for a payment intent',
  })
  @ApiResponse({
    status: 200,
    description: '3D Secure authentication initialized successfully',
    type: ThreeDSecureResultDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request parameters',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async initialize3DSecure(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    initializeDto: InitializeThreeDSecureDto,
    @Request() req: any,
  ): Promise<ThreeDSecureResultDto> {
    try {
      this.logger.log(`Initializing 3D Secure for user: ${req.user.id}`, {
        paymentIntentId: initializeDto.paymentIntentId,
        amount: initializeDto.amount,
        currency: initializeDto.currency,
      });

      const result = await this.threeDSecureService.initialize3DSecure(
        initializeDto.paymentIntentId,
        req.user.id,
        req.ip,
        req.headers['user-agent'],
        initializeDto.billingDetails,
      );

      if (!result.success) {
        throw new BadRequestException(
          result.error || '3D Secure initialization failed',
        );
      }

      return {
        success: result.success,
        requiresAction: result.requiresAction,
        clientSecret: result.clientSecret,
        redirectUrl: result.redirectUrl,
        sessionId: result.sessionId,
        status: result.status,
        authenticationFlow: result.requiresAction
          ? 'challenge'
          : 'frictionless',
      };
    } catch (error) {
      this.logger.error(
        `Failed to initialize 3D Secure for user ${req.user.id}:`,
        error,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Failed to initialize 3D Secure authentication',
      );
    }
  }

  /**
   * Complete 3D Secure challenge
   */
  @Post('complete-challenge')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Complete 3D Secure challenge',
    description: 'Complete the 3D Secure challenge flow',
  })
  @ApiResponse({
    status: 200,
    description: '3D Secure challenge completed successfully',
    type: ThreeDSecureResultDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid challenge completion data',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async completeChallenge(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    completeDto: CompleteThreeDSecureChallengeDto,
    @Request() req: any,
  ): Promise<ThreeDSecureResultDto> {
    try {
      this.logger.log(
        `Completing 3D Secure challenge for user: ${req.user.id}`,
        {
          sessionId: completeDto.sessionId,
          paymentIntentId: completeDto.paymentIntentId,
        },
      );

      const result = await this.threeDSecureService.complete3DSecureChallenge(
        completeDto.sessionId,
        completeDto.paymentIntentId,
        completeDto.redirectResult,
      );

      if (!result.success) {
        throw new BadRequestException(
          result.error || '3D Secure challenge failed',
        );
      }

      return {
        success: result.success,
        requiresAction: result.requiresAction,
        sessionId: result.sessionId,
        status: result.status,
        authenticationFlow: 'challenge',
      };
    } catch (error) {
      this.logger.error(
        `Failed to complete 3D Secure challenge for user ${req.user.id}:`,
        error,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Failed to complete 3D Secure challenge',
      );
    }
  }

  /**
   * Check if 3D Secure is required for a payment
   */
  @Get('required')
  @ApiOperation({
    summary: 'Check 3D Secure requirements',
    description: 'Check if 3D Secure authentication is required for a payment',
  })
  @ApiQuery({
    name: 'amount',
    required: true,
    type: Number,
    description: 'Payment amount in major currency unit',
  })
  @ApiQuery({
    name: 'currency',
    required: false,
    type: String,
    description: 'Currency code (gbp, eur, usd)',
    default: 'gbp',
  })
  @ApiQuery({
    name: 'cardCountry',
    required: false,
    type: String,
    description: 'Card issuing country code',
  })
  @ApiQuery({
    name: 'issuingCountry',
    required: false,
    type: String,
    description: 'Card issuing country code',
  })
  @ApiResponse({
    status: 200,
    description: '3D Secure requirement check completed',
  })
  async check3DSecureRequired(
    @Request() req: any,
  ): Promise<{ required: boolean; reason?: string; riskScore?: number }> {
    try {
      const {
        amount,
        currency = 'gbp',
        cardCountry,
        issuingCountry,
      } = req.query;

      if (!amount || isNaN(parseFloat(amount))) {
        throw new BadRequestException(
          'Amount is required and must be a valid number',
        );
      }

      const required = await this.threeDSecureService.is3DSecureRequired(
        parseFloat(amount),
        currency,
        cardCountry,
        issuingCountry,
      );

      let reason: string;
      if (currency === 'eur' && this.isEEACountry(cardCountry)) {
        reason = 'PSD2 Strong Customer Authentication required';
      } else if (parseFloat(amount) >= 100) {
        reason = 'High-value transaction';
      } else {
        reason = 'Risk-based assessment';
      }

      return {
        required,
        reason,
      };
    } catch (error) {
      this.logger.error('Failed to check 3D Secure requirements:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Failed to check 3D Secure requirements',
      );
    }
  }

  /**
   * Get 3D Secure session status
   */
  @Get('session/:sessionId/status')
  @ApiOperation({
    summary: 'Get 3D Secure session status',
    description: 'Get the current status of a 3D Secure session',
  })
  @ApiParam({
    name: 'sessionId',
    description: '3D Secure session ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Session status retrieved successfully',
  })
  async getSessionStatus(
    @Param('sessionId') sessionId: string,
    @Request() req: any,
  ): Promise<{
    sessionId: string;
    status: string;
    isExpired: boolean;
    processingTime?: number;
  }> {
    try {
      // This would be implemented in the service
      // For now, return a mock response
      return {
        sessionId,
        status: ThreeDSStatus.COMPLETED,
        isExpired: false,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get session status for ${sessionId}:`,
        error,
      );
      throw new InternalServerErrorException('Failed to get session status');
    }
  }

  /**
   * Get 3D Secure statistics (Admin only)
   */
  @Get('stats')
  @UseGuards(AdminGuard)
  @ApiOperation({
    summary: 'Get 3D Secure statistics',
    description: 'Get 3D Secure authentication statistics (Admin only)',
  })
  @ApiQuery({
    name: 'timeRange',
    required: false,
    enum: ['24h', '7d', '30d'],
    description: 'Time range for statistics',
    default: '24h',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
  })
  async get3DSecureStats(@Request() req: any): Promise<any> {
    try {
      const { timeRange = '24h' } = req.query;

      const stats = await this.threeDSecureService.get3DSecureStats(timeRange);

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      this.logger.error('Failed to get 3D Secure statistics:', error);
      throw new InternalServerErrorException(
        'Failed to get 3D Secure statistics',
      );
    }
  }

  /**
   * Test 3D Secure flow (Admin only)
   */
  @Post('test')
  @UseGuards(AdminGuard)
  @ApiOperation({
    summary: 'Test 3D Secure flow',
    description: 'Test 3D Secure authentication flow (Admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Test completed successfully',
  })
  async test3DSecure(
    @Request() req: any,
  ): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log(`Testing 3D Secure flow by admin: ${req.user.email}`);

      // Test basic connectivity
      const testResult = await this.threeDSecureService.is3DSecureRequired(
        100,
        'gbp',
        'GB',
        'GB',
      );

      return {
        success: true,
        message: '3D Secure test completed successfully',
      };
    } catch (error) {
      this.logger.error('3D Secure test failed:', error);

      return {
        success: false,
        message: `Test failed: ${error.message}`,
      };
    }
  }

  private isEEACountry(country?: string): boolean {
    if (!country) return false;

    const eeaCountries = [
      'AT',
      'BE',
      'BG',
      'HR',
      'CY',
      'CZ',
      'DK',
      'EE',
      'FI',
      'FR',
      'DE',
      'GR',
      'HU',
      'IS',
      'IE',
      'IT',
      'LV',
      'LI',
      'LT',
      'LU',
      'MT',
      'NL',
      'NO',
      'PL',
      'PT',
      'RO',
      'SK',
      'SI',
      'ES',
      'SE',
    ];

    return eeaCountries.includes(country.toUpperCase());
  }
}
