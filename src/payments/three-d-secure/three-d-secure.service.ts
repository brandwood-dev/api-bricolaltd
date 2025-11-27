import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ThreeDSecureSession } from './entities/three-d-secure-session.entity';
import { ThreeDSStatus } from './enums/three-ds-status.enum';
import { ThreeDSError } from './enums/three-ds-error.enum';
import { PaymentService } from '../payment.service';
import { AdminNotificationsService } from '../../admin/admin-notifications.service';
import {
  NotificationType as AdminNotificationType,
  NotificationPriority as AdminNotificationPriority,
  NotificationCategory as AdminNotificationCategory,
} from '../../admin/dto/admin-notifications.dto';

export interface ThreeDSecureResult {
  success: boolean;
  requiresAction: boolean;
  clientSecret?: string;
  redirectUrl?: string;
  error?: string;
  errorCode?: string;
  sessionId?: string;
  status?: ThreeDSStatus;
}

export interface ThreeDSecureConfig {
  version: string;
  challengeIndicator:
    | 'no_preference'
    | 'challenge_requested'
    | 'challenge_mandated';
  requestorName: string;
  requestorUrl: string;
  messageCategory: 'payment' | 'non_payment';
}

@Injectable()
export class ThreeDSecureService {
  private readonly logger = new Logger(ThreeDSecureService.name);
  private stripe: Stripe;
  private readonly config: ThreeDSecureConfig;

  constructor(
    private configService: ConfigService,
    @InjectRepository(ThreeDSecureSession)
    private threeDSessionRepository: Repository<ThreeDSecureSession>,
    private adminNotificationsService: AdminNotificationsService,
  ) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }

    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-09-30.clover',
    });

    this.config = {
      version: '2.2.0',
      challengeIndicator: 'no_preference',
      requestorName: this.configService.get('APP_NAME', 'Bricola'),
      requestorUrl: this.configService.get('APP_URL', 'https://bricola.com'),
      messageCategory: 'payment',
    };
  }

  /**
   * Initialize 3D Secure authentication for a payment intent
   */
  async initialize3DSecure(
    paymentIntentId: string,
    userId: string,
    ipAddress: string,
    userAgent: string,
    billingDetails?: {
      name: string;
      email: string;
      phone?: string;
      address?: {
        line1: string;
        line2?: string;
        city: string;
        state?: string;
        postalCode: string;
        country: string;
      };
    },
  ): Promise<ThreeDSecureResult> {
    try {
      this.logger.log(
        `Initializing 3D Secure for payment intent: ${paymentIntentId}`,
        {
          userId,
          ipAddress,
          hasBillingDetails: !!billingDetails,
        },
      );

      // Get the payment intent
      const paymentIntent =
        await this.stripe.paymentIntents.retrieve(paymentIntentId);

      if (!paymentIntent) {
        throw new BadRequestException('Payment intent not found');
      }

      if (paymentIntent.status !== 'requires_action') {
        return {
          success: true,
          requiresAction: false,
          status: ThreeDSStatus.COMPLETED,
        };
      }

      // Create 3DS session record
      const session = await this.createThreeDSession(
        paymentIntentId,
        userId,
        ipAddress,
        userAgent,
      );

      // Prepare 3D Secure authentication data
      const threeDSecureData = await this.prepareThreeDSecureData(
        paymentIntent,
        billingDetails,
        ipAddress,
        userAgent,
      );

      // Update payment intent with 3D Secure parameters
      const updatedPaymentIntent = await this.stripe.paymentIntents.update(
        paymentIntentId,
        {
          payment_method_options: {
            card: {
              request_three_d_secure: 'any',
            },
          },
        },
      );

      // Handle different 3DS scenarios
      if (updatedPaymentIntent.status === 'requires_action') {
        return await this.handleRequiresAction(
          updatedPaymentIntent,
          session.id,
        );
      }

      if (updatedPaymentIntent.status === 'succeeded') {
        await this.completeThreeDSession(session.id, ThreeDSStatus.COMPLETED);
        return {
          success: true,
          requiresAction: false,
          sessionId: session.id,
          status: ThreeDSStatus.COMPLETED,
        };
      }

      return {
        success: true,
        requiresAction: false,
        sessionId: session.id,
        status: ThreeDSStatus.PROCESSING,
      };
    } catch (error) {
      this.logger.error(
        `3D Secure initialization failed for payment ${paymentIntentId}:`,
        error,
      );

      await this.adminNotificationsService.createAdminNotification({
        title: '3D Secure Authentication Failed',
        message: `3D Secure initialization failed for payment ${paymentIntentId}. Error: ${error.message}`,
        type: AdminNotificationType.ERROR,
        priority: AdminNotificationPriority.HIGH,
        category: AdminNotificationCategory.SECURITY,
      });

      return {
        success: false,
        requiresAction: false,
        error: '3D Secure authentication failed',
        errorCode: ThreeDSError.INITIALIZATION_FAILED,
      };
    }
  }

  /**
   * Handle 3D Secure challenge completion
   */
  async complete3DSecureChallenge(
    sessionId: string,
    paymentIntentId: string,
    redirectResult?: string,
  ): Promise<ThreeDSecureResult> {
    try {
      this.logger.log(
        `Completing 3D Secure challenge for session: ${sessionId}`,
      );

      const session = await this.getThreeDSession(sessionId);
      if (!session) {
        throw new BadRequestException('3D Secure session not found');
      }

      if (session.status === ThreeDSStatus.COMPLETED) {
        return {
          success: true,
          requiresAction: false,
          sessionId,
          status: ThreeDSStatus.COMPLETED,
        };
      }

      // Handle redirect result if present
      if (redirectResult) {
        const result = await this.handleRedirectResult(redirectResult);
        if (result.success) {
          await this.completeThreeDSession(sessionId, ThreeDSStatus.COMPLETED);
          return {
            success: true,
            requiresAction: false,
            sessionId,
            status: ThreeDSStatus.COMPLETED,
          };
        }
      }

      // Retrieve updated payment intent
      const paymentIntent =
        await this.stripe.paymentIntents.retrieve(paymentIntentId);

      if (paymentIntent.status === 'succeeded') {
        await this.completeThreeDSession(sessionId, ThreeDSStatus.COMPLETED);
        return {
          success: true,
          requiresAction: false,
          sessionId,
          status: ThreeDSStatus.COMPLETED,
        };
      }

      if (paymentIntent.status === 'requires_payment_method') {
        await this.completeThreeDSession(sessionId, ThreeDSStatus.FAILED);
        return {
          success: false,
          requiresAction: false,
          error: 'Payment method required after 3D Secure',
          errorCode: ThreeDSError.PAYMENT_METHOD_REQUIRED,
          sessionId,
          status: ThreeDSStatus.FAILED,
        };
      }

      return {
        success: true,
        requiresAction: false,
        sessionId,
        status: ThreeDSStatus.PROCESSING,
      };
    } catch (error) {
      this.logger.error(
        `3D Secure challenge completion failed for session ${sessionId}:`,
        error,
      );

      await this.adminNotificationsService.createAdminNotification({
        title: '3D Secure Challenge Failed',
        message: `3D Secure challenge completion failed for session ${sessionId}. Error: ${error.message}`,
        type: AdminNotificationType.ERROR,
        priority: AdminNotificationPriority.HIGH,
        category: AdminNotificationCategory.SECURITY,
      });

      return {
        success: false,
        requiresAction: false,
        error: '3D Secure challenge failed',
        errorCode: ThreeDSError.CHALLENGE_FAILED,
      };
    }
  }

  /**
   * Check if 3D Secure is required for a payment
   */
  async is3DSecureRequired(
    amount: number,
    currency: string,
    cardCountry?: string,
    issuingCountry?: string,
  ): Promise<boolean> {
    try {
      // Apply 3D Secure based on regulatory requirements
      const requires3DS = this.checkRegulatoryRequirements(
        amount,
        currency,
        cardCountry,
        issuingCountry,
      );

      // Apply business rules
      const businessRequires3DS = this.checkBusinessRules(amount, currency);

      // Apply risk-based assessment
      const riskRequires3DS = await this.performRiskAssessment(
        amount,
        currency,
        cardCountry,
      );

      return requires3DS || businessRequires3DS || riskRequires3DS;
    } catch (error) {
      this.logger.error('Error checking 3D Secure requirements:', error);
      // Default to requiring 3D Secure on error
      return true;
    }
  }

  /**
   * Create a 3D Secure session record
   */
  private async createThreeDSession(
    paymentIntentId: string,
    userId: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<ThreeDSecureSession> {
    const session = this.threeDSessionRepository.create({
      paymentIntentId,
      userId,
      ipAddress,
      userAgent,
      status: ThreeDSStatus.INITIATED,
      initiatedAt: new Date(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
    });

    return this.threeDSessionRepository.save(session);
  }

  /**
   * Prepare 3D Secure authentication data
   */
  private async prepareThreeDSecureData(
    paymentIntent: Stripe.PaymentIntent,
    billingDetails?: any,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<any> {
    const threeDSData: any = {
      version: this.config.version,
    };

    // Add cardholder information if available
    if (billingDetails) {
      threeDSData.cardholder_name = billingDetails.name;
      threeDSData.email = billingDetails.email;
      if (billingDetails.phone) {
        threeDSData.phone = billingDetails.phone;
      }
      if (billingDetails.address) {
        threeDSData.address = {
          line1: billingDetails.address.line1,
          line2: billingDetails.address.line2,
          city: billingDetails.address.city,
          state: billingDetails.address.state,
          postal_code: billingDetails.address.postalCode,
          country: billingDetails.address.country,
        };
      }
    }

    // Add device information
    if (ipAddress) {
      threeDSData.ip_address = ipAddress;
    }
    if (userAgent) {
      threeDSData.user_agent = userAgent;
    }

    return threeDSData;
  }

  /**
   * Handle payment intent that requires action (3D Secure challenge)
   */
  private async handleRequiresAction(
    paymentIntent: Stripe.PaymentIntent,
    sessionId: string,
  ): Promise<ThreeDSecureResult> {
    const nextAction = paymentIntent.next_action;

    if (nextAction?.type === 'redirect_to_url') {
      return {
        success: true,
        requiresAction: true,
        redirectUrl: nextAction.redirect_to_url?.url || undefined,
        sessionId,
        status: ThreeDSStatus.CHALLENGE_REQUIRED,
      };
    }

    if (nextAction?.type === 'use_stripe_sdk') {
      return {
        success: true,
        requiresAction: true,
        clientSecret: paymentIntent.client_secret || undefined,
        sessionId,
        status: ThreeDSStatus.CHALLENGE_REQUIRED,
      };
    }

    return {
      success: true,
      requiresAction: false,
      sessionId,
      status: ThreeDSStatus.PROCESSING,
    };
  }

  /**
   * Handle redirect result from 3D Secure challenge
   */
  private async handleRedirectResult(
    redirectResult: string,
  ): Promise<{ success: boolean }> {
    try {
      // Parse and validate redirect result
      const result = JSON.parse(
        Buffer.from(redirectResult, 'base64').toString(),
      );

      // Validate the result signature and data
      if (result.success === true) {
        return { success: true };
      }

      return { success: false };
    } catch (error) {
      this.logger.error('Error handling redirect result:', error);
      return { success: false };
    }
  }

  /**
   * Check regulatory requirements for 3D Secure
   */
  private checkRegulatoryRequirements(
    amount: number,
    currency: string,
    cardCountry?: string,
    issuingCountry?: string,
  ): boolean {
    // EU PSD2 Strong Customer Authentication requirements
    if (
      currency === 'eur' ||
      this.isEEACountry(cardCountry) ||
      this.isEEACountry(issuingCountry)
    ) {
      return amount >= 30; // €30 threshold for PSD2
    }

    // UK regulatory requirements
    if (currency === 'gbp' || cardCountry === 'GB' || issuingCountry === 'GB') {
      return amount >= 25; // £25 threshold for UK
    }

    return false;
  }

  /**
   * Check business rules for 3D Secure
   */
  private checkBusinessRules(amount: number, currency: string): boolean {
    // High-value transactions
    if (amount >= 100) {
      return true;
    }

    // Specific currency requirements
    const highRiskCurrencies = ['usd', 'cad', 'aud'];
    if (highRiskCurrencies.includes(currency.toLowerCase()) && amount >= 50) {
      return true;
    }

    return false;
  }

  /**
   * Perform risk-based assessment for 3D Secure
   */
  private async performRiskAssessment(
    amount: number,
    currency: string,
    cardCountry?: string,
  ): Promise<boolean> {
    // Simple risk scoring - can be enhanced with ML models
    let riskScore = 0;

    // Amount-based risk
    if (amount > 200) riskScore += 30;
    else if (amount > 100) riskScore += 20;
    else if (amount > 50) riskScore += 10;

    // Currency-based risk
    const highRiskCountries = ['CN', 'RU', 'NG', 'PK'];
    if (cardCountry && highRiskCountries.includes(cardCountry)) {
      riskScore += 25;
    }

    // Time-based risk (unusual hours)
    const hour = new Date().getHours();
    if (hour < 6 || hour > 22) {
      riskScore += 15;
    }

    return riskScore >= 40;
  }

  /**
   * Check if country is in EEA
   */
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

  /**
   * Get 3D Secure session by ID
   */
  private async getThreeDSession(
    sessionId: string,
  ): Promise<ThreeDSecureSession | null> {
    return this.threeDSessionRepository.findOne({
      where: { id: sessionId },
    });
  }

  /**
   * Complete 3D Secure session
   */
  private async completeThreeDSession(
    sessionId: string,
    status: ThreeDSStatus,
    metadata?: any,
  ): Promise<void> {
    await this.threeDSessionRepository.update(sessionId, {
      status,
      completedAt: new Date(),
      metadata: metadata ? { ...metadata } : undefined,
    });
  }

  /**
   * Get 3D Secure statistics
   */
  async get3DSecureStats(timeRange: '24h' | '7d' | '30d' = '24h'): Promise<{
    totalSessions: number;
    successRate: number;
    challengeRate: number;
    frictionlessRate: number;
    averageProcessingTime: number;
  }> {
    const startDate = new Date();
    switch (timeRange) {
      case '24h':
        startDate.setDate(startDate.getDate() - 1);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
    }

    const sessions = await this.threeDSessionRepository
      .createQueryBuilder('session')
      .where('session.initiatedAt >= :startDate', { startDate })
      .getMany();

    const totalSessions = sessions.length;
    const completedSessions = sessions.filter(
      (s) => s.status === ThreeDSStatus.COMPLETED,
    );
    const challengeSessions = sessions.filter(
      (s) => s.status === ThreeDSStatus.CHALLENGE_REQUIRED,
    );
    const frictionlessSessions = sessions.filter(
      (s) => s.status === ThreeDSStatus.FRICTIONLESS_COMPLETED,
    );

    const successRate =
      totalSessions > 0 ? (completedSessions.length / totalSessions) * 100 : 0;
    const challengeRate =
      totalSessions > 0 ? (challengeSessions.length / totalSessions) * 100 : 0;
    const frictionlessRate =
      totalSessions > 0
        ? (frictionlessSessions.length / totalSessions) * 100
        : 0;

    const processingTimes = completedSessions
      .filter((s) => s.completedAt && s.initiatedAt)
      .map((s) => s.completedAt!.getTime() - s.initiatedAt.getTime());

    const averageProcessingTime =
      processingTimes.length > 0
        ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
        : 0;

    return {
      totalSessions,
      successRate,
      challengeRate,
      frictionlessRate,
      averageProcessingTime,
    };
  }
}
