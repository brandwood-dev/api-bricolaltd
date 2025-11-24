import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, In, IsNull, Not } from 'typeorm';
import { Booking } from '../entities/booking.entity';
import { DepositCaptureJob } from '../entities/deposit-capture-job.entity';
import { StripeDepositService } from './stripe-deposit.service';
import { DepositCaptureStatus } from '../enums/deposit-capture-status.enum';
import { DepositJobStatus } from '../enums/deposit-job-status.enum';
import { BookingStatus } from '../enums/booking-status.enum';
import { DepositNotificationService } from './deposit-notification.service';
import {
  DepositNotificationData,
  DepositCaptureData,
  DepositJobMetadata,
} from '../interfaces/deposit-automation.interface';

@Injectable()
export class DepositSchedulerService {
  private readonly logger = new Logger(DepositSchedulerService.name);

  constructor(
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(DepositCaptureJob)
    private depositJobRepository: Repository<DepositCaptureJob>,
    private stripeDepositService: StripeDepositService,
    private depositNotificationService: DepositNotificationService,
  ) {}

  /**
   * Créer un job de capture de caution pour une réservation
   */
  async scheduleDepositCapture(booking: Booking): Promise<DepositCaptureJob> {
    try {
      // Calculer les dates de notification et de capture
      const startDate = new Date(booking.startDate);
      const notificationDate = new Date(
        startDate.getTime() - 48 * 60 * 60 * 1000,
      ); // 48h avant
      const captureDate = new Date(startDate.getTime() - 24 * 60 * 60 * 1000); // 24h avant

      const metadata: DepositJobMetadata = {
        bookingId: booking.id,
        depositAmount: booking.totalPrice * 0.2, // 20% du prix total
        currency: 'gbp',
        renterEmail: booking.renter.email,
        toolName: booking.tool.title,
        notificationScheduledAt: notificationDate,
        captureScheduledAt: captureDate,
      };

      const job = this.depositJobRepository.create({
        bookingId: booking.id,
        scheduledAt: captureDate,
        status: DepositJobStatus.SCHEDULED,
        metadata,
      });

      const savedJob = await this.depositJobRepository.save(job);
      this.logger.log(
        `Job de capture programmé: ${savedJob.id} pour booking: ${booking.id}`,
      );

      return savedJob;
    } catch (error) {
      this.logger.error(
        `Erreur lors de la programmation du job: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Cron job pour envoyer les notifications 48h avant
   * Exécuté toutes les heures
   */
  @Cron(CronExpression.EVERY_HOUR)
  async processDepositNotifications(): Promise<void> {
    this.logger.log('Traitement des notifications de caution...');

    try {
      const now = new Date();
      const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);

      // Trouver les réservations qui nécessitent une notification
      const bookingsToNotify = await this.bookingRepository.find({
        where: {
          status: In([BookingStatus.ACCEPTED, BookingStatus.PENDING]),
          depositCaptureStatus: DepositCaptureStatus.PENDING,
          depositNotificationSentAt: IsNull(),
          depositPaymentMethodId: Not(IsNull()),
          startDate: LessThan(in48Hours),
        },
        relations: ['renter', 'tool', 'owner'],
      });

      this.logger.log(
        `${bookingsToNotify.length} réservations nécessitent une notification`,
      );

      for (const booking of bookingsToNotify) {
        await this.sendDepositNotification(booking);
      }
    } catch (error) {
      this.logger.error(
        `Erreur lors du traitement des notifications: ${error.message}`,
      );
    }
  }

  /**
   * Cron job pour capturer les cautions 24h avant
   * Exécuté toutes les heures
   */
  @Cron(CronExpression.EVERY_HOUR)
  async processDepositCaptures(): Promise<void> {
    this.logger.log('Traitement des captures de caution...');

    try {
      const now = new Date();
      const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // Trouver les réservations prêtes pour la capture
      const bookingsToCapture = await this.bookingRepository.find({
        where: {
          status: In([BookingStatus.ACCEPTED, BookingStatus.PENDING]),
          depositCaptureStatus: DepositCaptureStatus.PENDING,
          depositPaymentMethodId: Not(IsNull()), // Méthode de paiement configurée
          startDate: LessThan(in24Hours),
          depositNotificationSentAt: Not(IsNull()), // Notification déjà envoyée
        },
        relations: ['renter', 'tool', 'owner'],
      });

      this.logger.log(
        `${bookingsToCapture.length} réservations prêtes pour capture`,
      );

      for (const booking of bookingsToCapture) {
        await this.captureBookingDeposit(booking);
      }
    } catch (error) {
      this.logger.error(
        `Erreur lors du traitement des captures: ${error.message}`,
      );
    }
  }

  /**
   * Envoyer une notification de rappel de caution
   */
  private async sendDepositNotification(booking: Booking): Promise<void> {
    try {
      const depositAmount = booking.totalPrice * 0.2; // 20% du prix total
      const hoursUntilCapture = 24; // 24h avant le début

      const notificationData = {
        booking,
        user: booking.renter,
        toolName: booking.tool.title,
        rentalStartDate: new Date(booking.startDate),
        rentalEndDate: new Date(booking.endDate),
        depositAmount,
        hoursUntilCapture,
      };

      // Envoyer l'email de notification
      const success =
        await this.depositNotificationService.sendDepositReminderEmail(
          notificationData,
        );

      if (success) {
        // Mettre à jour la réservation
        await this.bookingRepository.update(booking.id, {
          depositNotificationSentAt: new Date(),
        });

        // Mettre à jour le job si il existe
        const job = await this.depositJobRepository.findOne({
          where: { bookingId: booking.id },
        });

        if (job) {
          await this.depositJobRepository.update(job.id, {
            status: DepositJobStatus.NOTIFICATION_SENT,
            notificationSentAt: new Date(),
          });
        }

        this.logger.log(`Notification envoyée pour booking: ${booking.id}`);
      } else {
        this.logger.error(
          `Échec de l'envoi de notification pour booking: ${booking.id}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'envoi de notification pour ${booking.id}: ${error.message}`,
      );
    }
  }

  /**
   * Capturer la caution pour une réservation
   */
  private async captureBookingDeposit(booking: Booking): Promise<void> {
    try {
      if (!booking.stripeCustomerId || !booking.depositPaymentMethodId) {
        this.logger.warn(
          `Données Stripe manquantes pour booking: ${booking.id}`,
        );
        return;
      }

      const captureData: DepositCaptureData = {
        bookingId: booking.id,
        amount: booking.totalPrice * 0.2, // 20% du prix total
        currency: 'gbp',
        paymentMethodId: booking.depositPaymentMethodId,
        customerId: booking.stripeCustomerId,
      };

      // Mettre à jour le statut du job
      const job = await this.depositJobRepository.findOne({
        where: { bookingId: booking.id },
      });

      if (job) {
        await this.depositJobRepository.update(job.id, {
          status: DepositJobStatus.CAPTURING,
          captureAttemptedAt: new Date(),
        });
      }

      // Tenter la capture
      const result =
        await this.stripeDepositService.captureDeposit(captureData);

      if (result.success) {
        // Capture réussie
        await this.bookingRepository.update(booking.id, {
          depositCaptureStatus: DepositCaptureStatus.SUCCESS,
          depositCapturedAt: new Date(),
        });

        if (job) {
          await this.depositJobRepository.update(job.id, {
            status: DepositJobStatus.SUCCESS,
          });
        }

        // Envoyer email de confirmation
        const notificationData = {
          booking,
          user: booking.renter,
          toolName: booking.tool.title,
          rentalStartDate: new Date(booking.startDate),
          rentalEndDate: new Date(booking.endDate),
          depositAmount: captureData.amount,
          hoursUntilCapture: 0,
          capturedAmount: captureData.amount,
        };
        await this.depositNotificationService.sendDepositCapturedEmail(
          notificationData,
        );

        this.logger.log(
          `Caution capturée avec succès pour booking: ${booking.id}`,
        );
      } else {
        // Capture échouée
        await this.bookingRepository.update(booking.id, {
          depositCaptureStatus: DepositCaptureStatus.FAILED,
          depositFailureReason: result.error,
        });

        if (job) {
          await this.depositJobRepository.update(job.id, {
            status: DepositJobStatus.FAILED,
            lastError: result.error,
            retryCount: job.retryCount + 1,
          });
        }

        // Envoyer email d'échec
        const failureNotificationData = {
          booking,
          user: booking.renter,
          toolName: booking.tool.title,
          rentalStartDate: new Date(booking.startDate),
          rentalEndDate: new Date(booking.endDate),
          depositAmount: captureData.amount,
          hoursUntilCapture: 0,
          failureReason: result.error || 'Erreur inconnue lors de la capture',
        };
        await this.depositNotificationService.sendDepositFailedEmail(
          failureNotificationData,
        );

        this.logger.error(
          `Échec de capture pour booking: ${booking.id} - ${result.error}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Erreur lors de la capture pour ${booking.id}: ${error.message}`,
      );

      // Marquer comme échoué
      await this.bookingRepository.update(booking.id, {
        depositCaptureStatus: DepositCaptureStatus.FAILED,
        depositFailureReason: error.message,
      });

      const job = await this.depositJobRepository.findOne({
        where: { bookingId: booking.id },
      });

      if (job) {
        await this.depositJobRepository.update(job.id, {
          status: DepositJobStatus.FAILED,
          lastError: error.message,
          retryCount: job.retryCount + 1,
        });
      }
    }
  }

  /**
   * Récupérer tous les jobs de capture de caution
   */
  async getAllDepositJobs(): Promise<DepositCaptureJob[]> {
    try {
      const jobs = await this.depositJobRepository.find({
        relations: ['booking', 'booking.renter', 'booking.tool'],
        order: {
          scheduledAt: 'DESC',
        },
      });

      this.logger.log(`${jobs.length} jobs de caution récupérés`);
      return jobs;
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération des jobs: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Récupérer les jobs de capture de caution par statut
   */
  async getDepositJobsByStatus(
    status: DepositJobStatus,
  ): Promise<DepositCaptureJob[]> {
    try {
      const jobs = await this.depositJobRepository.find({
        where: { status },
        relations: ['booking', 'booking.renter', 'booking.tool'],
        order: {
          scheduledAt: 'DESC',
        },
      });

      this.logger.log(`${jobs.length} jobs avec statut ${status} récupérés`);
      return jobs;
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération des jobs par statut: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Nettoyer les anciens jobs terminés (plus de 30 jours)
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupOldJobs(): Promise<void> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await this.depositJobRepository.delete({
        status: In([DepositJobStatus.SUCCESS, DepositJobStatus.CANCELLED]),
        updatedAt: LessThan(thirtyDaysAgo),
      });

      this.logger.log(`${result.affected} anciens jobs supprimés`);
    } catch (error) {
      this.logger.error(`Erreur lors du nettoyage: ${error.message}`);
    }
  }
}
