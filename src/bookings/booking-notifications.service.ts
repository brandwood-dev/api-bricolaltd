import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { AdminNotificationsService } from '../admin/admin-notifications.service';
import { Booking } from './entities/booking.entity';
import { User } from '../users/entities/user.entity';
import { Tool } from '../tools/entities/tool.entity';
import { NotificationType } from '../notifications/enums/notification-type';
import {
  NotificationType as AdminNotificationType,
  NotificationPriority as AdminNotificationPriority,
  NotificationCategory as AdminNotificationCategory,
} from '../admin/dto/admin-notifications.dto';

@Injectable()
export class BookingNotificationsService {
  constructor(
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Tool)
    private toolRepository: Repository<Tool>,
    private notificationsService: NotificationsService,
    private adminNotificationsService: AdminNotificationsService,
  ) {}

  private getI18nMetadata(
    titleKey: string,
    messageKey: string,
    translationParams?: Record<string, string | number | boolean>,
  ) {
    return {
      titleKey,
      messageKey,
      translationParams,
    };
  }

  // Notifications pour les utilisateurs
  async notifyBookingCreated(booking: Booking): Promise<void> {
    const [renter, tool] = await Promise.all([
      this.userRepository.findOne({ where: { id: booking.renterId } }),
      this.toolRepository.findOne({ where: { id: booking.toolId } }),
    ]);

    if (!renter || !tool) return;

    // Récupérer le propriétaire de l'outil
    const owner = await this.userRepository.findOne({
      where: { id: tool.ownerId },
    });
    if (!owner) return;

    // Notification au locataire
    await this.notificationsService.create({
      userId: renter.id,
      title: 'Réservation créée',
      message: `Votre réservation pour "${tool.title}" a été créée avec succès.`,
      type: NotificationType.BOOKING_CREATED,
      ...this.getI18nMetadata(
        'notifications.content.booking_created_renter.title',
        'notifications.content.booking_created_renter_legacy.message',
        { toolName: tool.title },
      ),
      relatedId: booking.id,
      relatedType: 'booking',
    });

    // Notification au propriétaire
    await this.notificationsService.create({
      userId: owner.id,
      title: 'Nouvelle réservation',
      message: `${renter.firstName} ${renter.lastName} a réservé votre outil "${tool.title}".`,
      type: NotificationType.BOOKING_CREATED,
      ...this.getI18nMetadata(
        'notifications.content.booking_created_owner_legacy.title',
        'notifications.content.booking_created_owner_legacy.message',
        {
          userName: `${renter.firstName} ${renter.lastName}`,
          toolName: tool.title,
        },
      ),
      relatedId: booking.id,
      relatedType: 'booking',
    });

    // Notification admin
    await this.adminNotificationsService.createAdminNotification({
      title: 'Nouvelle réservation',
      message: `Réservation #${booking.id} créée pour "${tool.title}" (${booking.totalPrice}€)`,
      type: AdminNotificationType.INFO,
      priority: AdminNotificationPriority.MEDIUM,
      category: AdminNotificationCategory.BOOKING,
      // metadata: {
      //   bookingId: booking.id,
      //   amount: booking.totalPrice,
      //   toolName: tool.title
      // } // Removed to fix row size issue
    });
  }

  async notifyBookingConfirmed(booking: Booking): Promise<void> {
    const [renter, tool] = await Promise.all([
      this.userRepository.findOne({ where: { id: booking.renterId } }),
      this.toolRepository.findOne({ where: { id: booking.toolId } }),
    ]);

    if (!renter || !tool) return;

    const owner = await this.userRepository.findOne({
      where: { id: tool.ownerId },
    });
    if (!owner) return;

    // Notification au locataire
    await this.notificationsService.create({
      userId: renter.id,
      title: 'Booking confirmed',
      message: `Your booking for "${tool.title}" has been confirmed.`,
      type: NotificationType.BOOKING_CONFIRMED,
      ...this.getI18nMetadata(
        'notifications.content.booking_confirmed_renter.title',
        'notifications.content.booking_confirmed_renter_legacy.message',
        { toolName: tool.title },
      ),
      relatedId: booking.id,
      relatedType: 'booking',
    });

    // Notification au propriétaire
    await this.notificationsService.create({
      userId: owner.id,
      title: 'Booking confirmed',
      message: `You have confirmed the booking of ${renter.firstName} ${renter.lastName}.`,
      type: NotificationType.BOOKING_CONFIRMED,
      ...this.getI18nMetadata(
        'notifications.content.booking_confirmed_owner.title',
        'notifications.content.booking_confirmed_owner_legacy.message',
        { userName: `${renter.firstName} ${renter.lastName}` },
      ),
      relatedId: booking.id,
      relatedType: 'booking',
    });
  }

  async notifyBookingCancelled(
    booking: Booking,
    cancelledBy: 'client' | 'provider',
  ): Promise<void> {
    const [renter, tool] = await Promise.all([
      this.userRepository.findOne({ where: { id: booking.renterId } }),
      this.toolRepository.findOne({ where: { id: booking.toolId } }),
    ]);

    if (!renter || !tool) return;

    const owner = await this.userRepository.findOne({
      where: { id: tool.ownerId },
    });
    if (!owner) return;

    const cancellerName =
      cancelledBy === 'client'
        ? `${renter.firstName} ${renter.lastName}`
        : `${owner.firstName} ${owner.lastName}`;
    const otherParty = cancelledBy === 'client' ? owner : renter;

    // Notification à l'autre partie
    await this.notificationsService.create({
      userId: otherParty.id,
      title: 'Booking cancelled',
      message: `Your booking for "${tool.title}" has been cancelled by ${cancellerName}.`,
      type: NotificationType.BOOKING_CANCELLED,
      ...this.getI18nMetadata(
        cancelledBy === 'client'
          ? 'notifications.content.booking_cancelled_owner.title'
          : 'notifications.content.booking_cancelled_renter.title',
        'notifications.content.booking_cancelled_legacy.message',
        {
          toolName: tool.title,
          userName: cancellerName,
        },
      ),
      relatedId: booking.id,
      relatedType: 'booking',
    });

    // Notification admin si montant élevé
    if (booking.totalPrice > 500) {
      await this.adminNotificationsService.createAdminNotification({
        title: 'Booking cancelled',
        message: `Booking #${booking.id} cancelled by ${cancelledBy} (${booking.totalPrice}€)`,
        type: AdminNotificationType.WARNING,
        priority: AdminNotificationPriority.HIGH,
        category: AdminNotificationCategory.BOOKING,
        // metadata: {
        //   bookingId: booking.id,
        //   cancelledBy,
        //   amount: booking.totalPrice
        // } // Removed to fix row size issue
      });
    }
  }

  async notifyBookingCompleted(booking: Booking): Promise<void> {
    const [renter, tool] = await Promise.all([
      this.userRepository.findOne({ where: { id: booking.renterId } }),
      this.toolRepository.findOne({ where: { id: booking.toolId } }),
    ]);

    if (!renter || !tool) return;

    const owner = await this.userRepository.findOne({
      where: { id: tool.ownerId },
    });
    if (!owner) return;

    // Notification au locataire pour évaluation
    await this.notificationsService.create({
      userId: renter.id,
      title: 'Booking completed',
      message: `Your booking for "${tool.title}" has been completed.`,
      type: NotificationType.BOOKING_COMPLETED,
      ...this.getI18nMetadata(
        'notifications.content.booking_completed_legacy.title',
        'notifications.content.booking_completed_renter_legacy_alt.message',
        { toolName: tool.title },
      ),
      relatedId: booking.id,
      relatedType: 'booking',
    });

    // Notification au propriétaire
    await this.notificationsService.create({
      userId: owner.id,
      title: 'Booking completed',
      message: `Your booking for "${tool.title}" by ${renter.firstName} ${renter.lastName} has been completed.`,
      type: NotificationType.BOOKING_COMPLETED,
      ...this.getI18nMetadata(
        'notifications.content.booking_completed_legacy.title',
        'notifications.content.booking_completed_owner_legacy_alt.message',
        {
          toolName: tool.title,
          userName: `${renter.firstName} ${renter.lastName}`,
        },
      ),
      relatedId: booking.id,
      relatedType: 'booking',
    });
  }

  async notifyPaymentReceived(booking: Booking): Promise<void> {
    const tool = await this.toolRepository.findOne({
      where: { id: booking.toolId },
    });
    if (!tool) return;

    const owner = await this.userRepository.findOne({
      where: { id: tool.ownerId },
    });
    if (!owner) return;

    await this.notificationsService.create({
      userId: owner.id,
      title: 'Payment received',
      message: `Payment for "${tool.title}" has been received (${booking.totalPrice}£).`,
      type: NotificationType.PAYMENT_RECEIVED,
      ...this.getI18nMetadata(
        'notifications.content.payment_received_owner.title',
        'notifications.content.payment_received_owner_legacy.message',
        {
          toolName: tool.title,
          amount: booking.totalPrice,
        },
      ),
      relatedId: booking.id,
      relatedType: 'booking',
    });
  }
}
