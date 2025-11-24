import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { AdminNotification } from './entities/admin-notification.entity';
import {
  CreateAdminNotificationDto,
  AdminNotificationFilterDto,
  NotificationType,
  NotificationPriority,
  NotificationCategory,
} from './dto/admin-notifications.dto';
import { AdminNotificationsGateway } from '../notifications/admin-notifications.gateway';
import { SendGridService } from '../emails/sendgrid.service';
import { User } from '../users/entities/user.entity';
import { InjectRepository as InjectRepo } from '@nestjs/typeorm';

@Injectable()
export class AdminNotificationsService {
  private readonly logger = new Logger(AdminNotificationsService.name);
  constructor(
    @InjectRepository(AdminNotification)
    private readonly adminNotificationRepository: Repository<AdminNotification>,
    @Inject(forwardRef(() => AdminNotificationsGateway))
    private readonly adminGateway: AdminNotificationsGateway,
    private readonly sendGridService: SendGridService,
    @InjectRepo(User) private readonly usersRepository: Repository<User>,
  ) {}

  async getAdminNotifications(filters: AdminNotificationFilterDto) {
    const {
      page = 1,
      limit = 50,
      type,
      category,
      priority,
      isRead,
      search,
      userId,
    } = filters;

    const queryBuilder = this.adminNotificationRepository
      .createQueryBuilder('notification')
      .orderBy('notification.createdAt', 'DESC');

    // Apply filters
    if (type) {
      queryBuilder.andWhere('notification.type = :type', { type });
    }

    if (category) {
      queryBuilder.andWhere('notification.category = :category', { category });
    }

    if (priority) {
      queryBuilder.andWhere('notification.priority = :priority', { priority });
    }

    if (typeof isRead === 'boolean') {
      queryBuilder.andWhere('notification.isRead = :isRead', { isRead });
    }

    if (userId) {
      queryBuilder.andWhere('notification.userId = :userId', { userId });
    }

    if (search) {
      queryBuilder.andWhere(
        '(LOWER(notification.title) LIKE LOWER(:search) OR LOWER(notification.message) LIKE LOWER(:search) OR LOWER(notification.userName) LIKE LOWER(:search))',
        { search: `%${search}%` },
      );
    }

    // Pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [notifications, total] = await queryBuilder.getManyAndCount();

    return {
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUnreadCount(): Promise<number> {
    return await this.adminNotificationRepository.count({
      where: { isRead: false },
    });
  }

  async createAdminNotification(
    createNotificationDto: CreateAdminNotificationDto,
  ): Promise<AdminNotification> {
    const notification = this.adminNotificationRepository.create({
      ...createNotificationDto,
      isRead: false,
      createdAt: new Date(),
    });

    const savedNotification =
      await this.adminNotificationRepository.save(notification);

    // Broadcast to connected admins via WebSocket
    try {
      this.adminGateway?.broadcastAdminNotification(savedNotification);
      await this.adminGateway?.broadcastUnreadCountUpdate();
    } catch (e) {
      // Swallow WS errors to not affect DB operation
    }

    // Auto-read functionality
    if (createNotificationDto.autoReadAfter) {
      setTimeout(
        async () => {
          await this.markNotificationsAsRead([savedNotification.id]);
        },
        createNotificationDto.autoReadAfter * 60 * 1000,
      ); // Convert minutes to milliseconds
    }

    // Email on critical notifications
    try {
      const shouldEmail =
        savedNotification.priority === NotificationPriority.URGENT ||
        savedNotification.category === NotificationCategory.SECURITY;

      if (shouldEmail) {
        const adminEmails = await this.getAdminEmailRecipients();
        await this.sendCriticalEmail(savedNotification, adminEmails);
      }
    } catch (e) {
      this.logger.warn(
        `Failed to send critical email for admin notification ${savedNotification.id}: ${e?.message || e}`,
      );
    }

    return savedNotification;
  }

  async markNotificationsAsRead(notificationIds: string[]): Promise<void> {
    await this.adminNotificationRepository.update(
      { id: In(notificationIds) },
      {
        isRead: true,
        readAt: new Date(),
      },
    );

    try {
      await this.adminGateway?.broadcastUnreadCountUpdate();
    } catch {}
  }

  async markAllAsRead(): Promise<void> {
    await this.adminNotificationRepository.update(
      { isRead: false },
      {
        isRead: true,
        readAt: new Date(),
      },
    );

    try {
      await this.adminGateway?.broadcastUnreadCountUpdate();
    } catch {}
  }

  async deleteNotifications(notificationIds: string[]): Promise<void> {
    const result = await this.adminNotificationRepository.delete({
      id: In(notificationIds),
    });

    if (result.affected === 0) {
      throw new NotFoundException('No notifications found to delete');
    }

    try {
      await this.adminGateway?.broadcastUnreadCountUpdate();
    } catch {}
  }

  async broadcastToAllAdmins(
    notificationDto: CreateAdminNotificationDto,
  ): Promise<void> {
    // Create a system-wide notification
    await this.createAdminNotification({
      ...notificationDto,
      category: NotificationCategory.SYSTEM,
      priority: notificationDto.priority || NotificationPriority.HIGH,
    });

    try {
      await this.adminGateway?.broadcastUnreadCountUpdate();
    } catch {}
  }

  // Helper methods for creating specific types of notifications
  async createBookingNotification(
    title: string,
    message: string,
    bookingId: string,
    userId?: string,
    userName?: string,
    priority: NotificationPriority = NotificationPriority.MEDIUM,
  ): Promise<AdminNotification> {
    return await this.createAdminNotification({
      title,
      message,
      type: NotificationType.INFO,
      category: NotificationCategory.BOOKING,
      priority,
      userId,
      userName,
      // metadata: { bookingId }, // Removed to fix row size issue
    });
  }

  async createUserNotification(
    title: string,
    message: string,
    userId: string,
    userName?: string,
    priority: NotificationPriority = NotificationPriority.MEDIUM,
  ): Promise<AdminNotification> {
    return await this.createAdminNotification({
      title,
      message,
      type: NotificationType.INFO,
      category: NotificationCategory.USER,
      priority,
      userId,
      userName,
      // metadata: { userId }, // Removed to fix row size issue
    });
  }

  async createSystemNotification(
    title: string,
    message: string,
    type: NotificationType = NotificationType.SYSTEM,
    priority: NotificationPriority = NotificationPriority.HIGH,
    // metadata?: Record<string, any>, // Removed to fix row size issue
  ): Promise<AdminNotification> {
    return await this.createAdminNotification({
      title,
      message,
      type,
      category: NotificationCategory.SYSTEM,
      priority,
      // metadata, // Removed to fix row size issue
    });
  }

  async createSecurityNotification(
    title: string,
    message: string,
    userId?: string,
    userName?: string,
    // metadata?: Record<string, any>, // Removed to fix row size issue
  ): Promise<AdminNotification> {
    return await this.createAdminNotification({
      title,
      message,
      type: NotificationType.WARNING,
      category: NotificationCategory.SECURITY,
      priority: NotificationPriority.URGENT,
      userId,
      userName,
      // metadata, // Removed to fix row size issue
    });
  }

  async createPaymentNotification(
    title: string,
    message: string,
    userId?: string,
    userName?: string,
    transactionId?: string,
    priority: NotificationPriority = NotificationPriority.HIGH,
  ): Promise<AdminNotification> {
    return await this.createAdminNotification({
      title,
      message,
      type: NotificationType.INFO,
      category: NotificationCategory.PAYMENT,
      priority,
      userId,
      userName,
      // metadata: { transactionId }, // Removed to fix row size issue
    });
  }

  async createDisputeNotification(
    title: string,
    message: string,
    disputeId: string,
    userId?: string,
    userName?: string,
  ): Promise<AdminNotification> {
    return await this.createAdminNotification({
      title,
      message,
      type: NotificationType.WARNING,
      category: NotificationCategory.DISPUTE,
      priority: NotificationPriority.HIGH,
      userId,
      userName,
      // metadata: { disputeId }, // Removed to fix row size issue
    });
  }

  // Cleanup old notifications (can be called by a cron job)
  async cleanupOldNotifications(daysOld: number = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    await this.adminNotificationRepository
      .createQueryBuilder()
      .delete()
      .where('createdAt < :cutoffDate', { cutoffDate })
      .andWhere('isRead = :isRead', { isRead: true })
      .execute();
  }

  // Get notification statistics
  async getNotificationStats() {
    const [total, unread, byType, byCategory, byPriority] = await Promise.all([
      this.adminNotificationRepository.count(),
      this.adminNotificationRepository.count({ where: { isRead: false } }),
      this.adminNotificationRepository
        .createQueryBuilder('notification')
        .select('notification.type', 'type')
        .addSelect('COUNT(*)', 'count')
        .groupBy('notification.type')
        .getRawMany(),
      this.adminNotificationRepository
        .createQueryBuilder('notification')
        .select('notification.category', 'category')
        .addSelect('COUNT(*)', 'count')
        .groupBy('notification.category')
        .getRawMany(),
      this.adminNotificationRepository
        .createQueryBuilder('notification')
        .select('notification.priority', 'priority')
        .addSelect('COUNT(*)', 'count')
        .groupBy('notification.priority')
        .getRawMany(),
    ]);

    return {
      total,
      unread,
      read: total - unread,
      byType,
      byCategory,
      byPriority,
    };
  }

  // --- Email integration helpers ---
  private async getAdminEmailRecipients(): Promise<string[]> {
    try {
      const admins = await this.usersRepository.find({
        where: { isAdmin: true, isActive: true },
      });
      return admins.map((a) => a.email).filter(Boolean);
    } catch (e) {
      this.logger.warn(`Failed to load admin recipients: ${e?.message || e}`);
      return [];
    }
  }

  private async sendCriticalEmail(
    notification: AdminNotification,
    recipients: string[],
  ): Promise<void> {
    if (!Array.isArray(recipients) || recipients.length === 0) return;

    const subject = this.buildEmailSubject(notification);
    const { html, text } = this.buildEmailTemplate(notification);

    // Send individually to avoid SendGrid rate issues with arrays
    await Promise.all(
      recipients.map((to) =>
        this.sendGridService
          .sendEmail({ to, subject, html, text })
          .catch((e) => {
            this.logger.warn(`SendGrid failed for ${to}: ${e?.message || e}`);
            return false;
          }),
      ),
    );
  }

  private buildEmailSubject(notification: AdminNotification): string {
    const prefix =
      notification.category === NotificationCategory.SECURITY
        ? 'ALERTE SÉCURITÉ'
        : notification.category === NotificationCategory.DISPUTE
          ? 'NOUVEAU LITIGE'
          : notification.category === NotificationCategory.PAYMENT
            ? 'PAIEMENT'
            : 'SYSTÈME';
    const priority = notification.priority?.toUpperCase() || 'INFO';
    return `[${prefix} - ${priority}] ${notification.title || 'Notification Admin'}`;
  }

  private buildEmailTemplate(notification: AdminNotification): {
    html: string;
    text: string;
  } {
    const createdAt = notification.createdAt
      ? new Date(notification.createdAt).toLocaleString('fr-FR')
      : new Date().toLocaleString('fr-FR');
    const headerColor =
      notification.category === NotificationCategory.SECURITY
        ? '#dc3545'
        : '#0d6efd';
    const priorityBadge =
      notification.priority === NotificationPriority.URGENT
        ? 'Urgent'
        : notification.priority === NotificationPriority.HIGH
          ? 'Élevé'
          : notification.priority === NotificationPriority.MEDIUM
            ? 'Moyen'
            : 'Faible';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Alerte Admin</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${headerColor}; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { padding: 20px; background: #f9f9f9; border-radius: 0 0 8px 8px; }
          .badge { display: inline-block; padding: 4px 10px; background: #333; color: #fff; border-radius: 999px; font-size: 12px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${notification.title || 'Notification Admin'}</h1>
            <span class="badge">Priorité: ${priorityBadge}</span>
          </div>
          <div class="content">
            <p><strong>Catégorie:</strong> ${notification.category}</p>
            <p><strong>Message:</strong> ${notification.message || ''}</p>
            <p><strong>Date:</strong> ${createdAt}</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Bricola LTD. Tous droits réservés.</p>
            <p>Alerte automatique - Ne pas répondre</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
ALERTE ADMIN
Titre: ${notification.title || 'Notification Admin'}
Catégorie: ${notification.category}
Priorité: ${priorityBadge}
Message: ${notification.message || ''}
Date: ${createdAt}

© ${new Date().getFullYear()} Bricola LTD. Tous droits réservés.
`;

    return { html, text };
  }
}
