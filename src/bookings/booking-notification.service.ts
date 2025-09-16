import { Injectable } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/enums/notification-type';
import { Booking } from './entities/booking.entity';
import { BookingStatus } from './enums/booking-status.enum';
import { UsersService } from '../users/users.service';
import { ToolsService } from '../tools/tools.service';

@Injectable()
export class BookingNotificationService {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
    private readonly toolsService: ToolsService,
  ) {}

  async notifyBookingCreated(booking: Booking): Promise<void> {
    const tool = await this.toolsService.findOne(booking.toolId);
    const renter = await this.usersService.findOne(booking.renterId);
    const owner = await this.usersService.findOne(tool.ownerId);

    // Notify renter
    await this.notificationsService.createSystemNotification(
      booking.renterId,
      NotificationType.BOOKING_CREATED,
      'Réservation créée',
      `Votre demande de réservation pour "${tool.title}" a été soumise et est en attente de confirmation.`,
      booking.id,
      'booking',
      `/bookings/${booking.id}`,
    );

    // Notify owner
    await this.notificationsService.createSystemNotification(
      tool.ownerId,
      NotificationType.BOOKING_CREATED,
      'Nouvelle demande de réservation',
      `${renter.firstName} ${renter.lastName} souhaite réserver votre outil "${tool.title}" du ${this.formatDate(booking.startDate)} au ${this.formatDate(booking.endDate)}.`,
      booking.id,
      'booking',
      `/admin/bookings/${booking.id}`,
    );
  }

  async notifyBookingConfirmed(booking: Booking): Promise<void> {
    const tool = await this.toolsService.findOne(booking.toolId);
    const renter = await this.usersService.findOne(booking.renterId);
    const owner = await this.usersService.findOne(tool.ownerId);

    // Notify renter
    await this.notificationsService.createSystemNotification(
      booking.renterId,
      NotificationType.BOOKING_CONFIRMED,
      'Réservation confirmée',
      `Votre réservation pour "${tool.title}" a été confirmée ! Vous pouvez récupérer l'outil le ${this.formatDate(booking.startDate)}.`,
      booking.id,
      'booking',
      `/bookings/${booking.id}`,
    );

    // Notify owner
    await this.notificationsService.createSystemNotification(
      tool.ownerId,
      NotificationType.BOOKING_CONFIRMED,
      'Réservation confirmée',
      `Vous avez confirmé la réservation de "${tool.title}" pour ${renter.firstName} ${renter.lastName}.`,
      booking.id,
      'booking',
      `/admin/bookings/${booking.id}`,
    );
  }

  async notifyBookingAccepted(booking: Booking): Promise<void> {
    const tool = await this.toolsService.findOne(booking.toolId);
    const renter = await this.usersService.findOne(booking.renterId);
    const owner = await this.usersService.findOne(tool.ownerId);

    // Notify renter with validation code
    await this.notificationsService.createSystemNotification(
      booking.renterId,
      NotificationType.BOOKING_CONFIRMED,
      'Réservation acceptée',
      `Votre réservation pour "${tool.title}" a été acceptée ! Code de validation: ${booking.validationCode}. Présentez ce code lors de la récupération.`,
      booking.id,
      'booking',
      `/bookings/${booking.id}`,
    );

    // Notify owner
    await this.notificationsService.createSystemNotification(
      tool.ownerId,
      NotificationType.BOOKING_CONFIRMED,
      'Réservation acceptée',
      `Vous avez accepté la réservation de "${tool.title}" pour ${renter.firstName} ${renter.lastName}. Code de validation généré: ${booking.validationCode}`,
      booking.id,
      'booking',
      `/admin/bookings/${booking.id}`,
    );
  }

  async notifyBookingCancelled(booking: Booking, cancelledBy: 'renter' | 'owner', reason?: string): Promise<void> {
    const tool = await this.toolsService.findOne(booking.toolId);
    const renter = await this.usersService.findOne(booking.renterId);
    const owner = await this.usersService.findOne(tool.ownerId);

    if (cancelledBy === 'renter') {
      // Notify owner
      await this.notificationsService.createSystemNotification(
        tool.ownerId,
        NotificationType.BOOKING_CANCELLED,
        'Réservation annulée',
        `${renter.firstName} ${renter.lastName} a annulé sa réservation pour "${tool.title}".${reason ? ` Raison: ${reason}` : ''}`,
        booking.id,
        'booking',
        `/admin/bookings/${booking.id}`,
      );
    } else {
      // Notify renter
      await this.notificationsService.createSystemNotification(
        booking.renterId,
        NotificationType.BOOKING_CANCELLED,
        'Réservation annulée',
        `Votre réservation pour "${tool.title}" a été annulée par le propriétaire.${reason ? ` Raison: ${reason}` : ''}`,
        booking.id,
        'booking',
        `/bookings/${booking.id}`,
      );
    }
  }

  async notifyBookingRejected(booking: Booking, refusalReason?: string): Promise<void> {
    const tool = await this.toolsService.findOne(booking.toolId);
    const renter = await this.usersService.findOne(booking.renterId);
    const owner = await this.usersService.findOne(tool.ownerId);

    // Notify renter
    await this.notificationsService.createSystemNotification(
      booking.renterId,
      NotificationType.BOOKING_CANCELLED,
      'Demande de réservation refusée',
      `Votre demande de réservation pour "${tool.title}" a été refusée.${refusalReason ? ` Raison: ${refusalReason}` : ''}`,
      booking.id,
      'booking',
      `/bookings/${booking.id}`,
    );

    // Notify owner
    await this.notificationsService.createSystemNotification(
      tool.ownerId,
      NotificationType.BOOKING_CANCELLED,
      'Demande de réservation refusée',
      `Vous avez refusé la demande de réservation de "${tool.title}" par ${renter.firstName} ${renter.lastName}.`,
      booking.id,
      'booking',
      `/admin/bookings/${booking.id}`,
    );
  }

  async notifyBookingStarted(booking: Booking): Promise<void> {
    const tool = await this.toolsService.findOne(booking.toolId);
    const renter = await this.usersService.findOne(booking.renterId);
    const owner = await this.usersService.findOne(tool.ownerId);

    // Notify renter
    await this.notificationsService.createSystemNotification(
      booking.renterId,
      NotificationType.BOOKING_CONFIRMED,
      'Réservation commencée',
      `Votre réservation pour "${tool.title}" a commencé ! Profitez bien de votre location.`,
      booking.id,
      'booking',
      `/bookings/${booking.id}`,
    );

    // Notify owner
    await this.notificationsService.createSystemNotification(
      tool.ownerId,
      NotificationType.BOOKING_CONFIRMED,
      'Réservation commencée',
      `La réservation de "${tool.title}" par ${renter.firstName} ${renter.lastName} a commencé.`,
      booking.id,
      'booking',
      `/admin/bookings/${booking.id}`,
    );
  }

  async notifyBookingCompleted(booking: Booking): Promise<void> {
    const tool = await this.toolsService.findOne(booking.toolId);
    const renter = await this.usersService.findOne(booking.renterId);
    const owner = await this.usersService.findOne(tool.ownerId);

    // Notify renter
    await this.notificationsService.createSystemNotification(
      booking.renterId,
      NotificationType.BOOKING_COMPLETED,
      'Réservation terminée',
      `Votre réservation pour "${tool.title}" est maintenant terminée. N'oubliez pas de laisser un avis !`,
      booking.id,
      'booking',
      `/bookings/${booking.id}`,
    );

    // Notify owner
    await this.notificationsService.createSystemNotification(
      tool.ownerId,
      NotificationType.BOOKING_COMPLETED,
      'Réservation terminée',
      `La réservation de "${tool.title}" par ${renter.firstName} ${renter.lastName} est maintenant terminée.`,
      booking.id,
      'booking',
      `/admin/bookings/${booking.id}`,
    );
  }

  async notifyBookingReminder(booking: Booking, type: 'start' | 'end'): Promise<void> {
    const tool = await this.toolsService.findOne(booking.toolId);
    const renter = await this.usersService.findOne(booking.renterId);
    const owner = await this.usersService.findOne(tool.ownerId);

    if (type === 'start') {
      // Remind renter about pickup
      await this.notificationsService.createSystemNotification(
        booking.renterId,
        NotificationType.BOOKING_REMINDER,
        'Rappel de récupération',
        `N'oubliez pas de récupérer "${tool.title}" demain (${this.formatDate(booking.startDate)}).`,
        booking.id,
        'booking',
        `/bookings/${booking.id}`,
      );

      // Remind owner about handover
      await this.notificationsService.createSystemNotification(
        tool.ownerId,
        NotificationType.BOOKING_REMINDER,
        'Rappel de remise',
        `Rappel: ${renter.firstName} ${renter.lastName} doit récupérer "${tool.title}" demain.`,
        booking.id,
        'booking',
        `/admin/bookings/${booking.id}`,
      );
    } else {
      // Remind renter about return
      await this.notificationsService.createSystemNotification(
        booking.renterId,
        NotificationType.BOOKING_REMINDER,
        'Rappel de retour',
        `N'oubliez pas de retourner "${tool.title}" demain (${this.formatDate(booking.endDate)}).`,
        booking.id,
        'booking',
        `/bookings/${booking.id}`,
      );

      // Remind owner about return
      await this.notificationsService.createSystemNotification(
        tool.ownerId,
        NotificationType.BOOKING_REMINDER,
        'Rappel de retour',
        `Rappel: ${renter.firstName} ${renter.lastName} doit retourner "${tool.title}" demain.`,
        booking.id,
        'booking',
        `/admin/bookings/${booking.id}`,
      );
    }
  }

  async notifyBookingOverdue(booking: Booking): Promise<void> {
    const tool = await this.toolsService.findOne(booking.toolId);
    const renter = await this.usersService.findOne(booking.renterId);
    const owner = await this.usersService.findOne(tool.ownerId);

    // Notify renter
    await this.notificationsService.createSystemNotification(
      booking.renterId,
      NotificationType.BOOKING_OVERDUE,
      'Retour en retard',
      `Votre réservation pour "${tool.title}" est en retard. Veuillez retourner l'outil dès que possible.`,
      booking.id,
      'booking',
      `/bookings/${booking.id}`,
    );

    // Notify owner
    await this.notificationsService.createSystemNotification(
      tool.ownerId,
      NotificationType.BOOKING_OVERDUE,
      'Retour en retard',
      `La réservation de "${tool.title}" par ${renter.firstName} ${renter.lastName} est en retard.`,
      booking.id,
      'booking',
      `/admin/bookings/${booking.id}`,
    );
  }

  async notifyPaymentReceived(booking: Booking): Promise<void> {
    const tool = await this.toolsService.findOne(booking.toolId);
    const renter = await this.usersService.findOne(booking.renterId);
    const owner = await this.usersService.findOne(tool.ownerId);

    // Notify renter
    await this.notificationsService.createSystemNotification(
      booking.renterId,
      NotificationType.PAYMENT_RECEIVED,
      'Paiement confirmé',
      `Votre paiement pour la réservation de "${tool.title}" a été confirmé.`,
      booking.id,
      'booking',
      `/bookings/${booking.id}`,
    );

    // Notify owner
    await this.notificationsService.createSystemNotification(
      tool.ownerId,
      NotificationType.PAYMENT_RECEIVED,
      'Paiement reçu',
      `Le paiement pour la réservation de "${tool.title}" par ${renter.firstName} ${renter.lastName} a été reçu.`,
      booking.id,
      'booking',
      `/admin/bookings/${booking.id}`,
    );
  }

  async notifyPaymentFailed(booking: Booking): Promise<void> {
    const tool = await this.toolsService.findOne(booking.toolId);
    const renter = await this.usersService.findOne(booking.renterId);

    // Notify renter
    await this.notificationsService.createSystemNotification(
      booking.renterId,
      NotificationType.PAYMENT_FAILED,
      'Échec du paiement',
      `Le paiement pour votre réservation de "${tool.title}" a échoué. Veuillez réessayer.`,
      booking.id,
      'booking',
      `/bookings/${booking.id}`,
    );
  }

  async notifyToolReturned(booking: Booking, notes?: string): Promise<void> {
    const tool = await this.toolsService.findOne(booking.toolId);
    const renter = await this.usersService.findOne(booking.renterId);
    const owner = await this.usersService.findOne(tool.ownerId);

    // Notify owner
    await this.notificationsService.createSystemNotification(
      tool.ownerId,
      NotificationType.BOOKING_COMPLETED,
      'Outil retourné',
      `${renter.firstName} ${renter.lastName} a confirmé le retour de "${tool.title}".${notes ? ` Notes: ${notes}` : ''}`,
      booking.id,
      'booking',
      `/admin/bookings/${booking.id}`,
    );

    // Notify renter (confirmation)
    await this.notificationsService.createSystemNotification(
      booking.renterId,
      NotificationType.BOOKING_COMPLETED,
      'Retour confirmé',
      `Vous avez confirmé le retour de "${tool.title}". Merci pour votre location !`,
      booking.id,
      'booking',
      `/bookings/${booking.id}`,
    );
  }

  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(date));
  }
}