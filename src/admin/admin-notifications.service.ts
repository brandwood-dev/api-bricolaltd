import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { AdminNotification } from './entities/admin-notification.entity';
import { 
  CreateAdminNotificationDto, 
  AdminNotificationFilterDto,
  NotificationType,
  NotificationPriority,
  NotificationCategory
} from './dto/admin-notifications.dto';

@Injectable()
export class AdminNotificationsService {
  constructor(
    @InjectRepository(AdminNotification)
    private readonly adminNotificationRepository: Repository<AdminNotification>,
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
        '(notification.title ILIKE :search OR notification.message ILIKE :search OR notification.userName ILIKE :search)',
        { search: `%${search}%` }
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

    const savedNotification = await this.adminNotificationRepository.save(notification);

    // Auto-read functionality
    if (createNotificationDto.autoReadAfter) {
      setTimeout(async () => {
        await this.markNotificationsAsRead([savedNotification.id]);
      }, createNotificationDto.autoReadAfter * 60 * 1000); // Convert minutes to milliseconds
    }

    return savedNotification;
  }

  async markNotificationsAsRead(notificationIds: string[]): Promise<void> {
    await this.adminNotificationRepository.update(
      { id: In(notificationIds) },
      { 
        isRead: true,
        readAt: new Date(),
      }
    );
  }

  async markAllAsRead(): Promise<void> {
    await this.adminNotificationRepository.update(
      { isRead: false },
      { 
        isRead: true,
        readAt: new Date(),
      }
    );
  }

  async deleteNotifications(notificationIds: string[]): Promise<void> {
    const result = await this.adminNotificationRepository.delete({
      id: In(notificationIds),
    });

    if (result.affected === 0) {
      throw new NotFoundException('No notifications found to delete');
    }
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
      metadata: { bookingId },
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
      metadata: { userId },
    });
  }

  async createSystemNotification(
    title: string,
    message: string,
    type: NotificationType = NotificationType.SYSTEM,
    priority: NotificationPriority = NotificationPriority.HIGH,
    metadata?: Record<string, any>,
  ): Promise<AdminNotification> {
    return await this.createAdminNotification({
      title,
      message,
      type,
      category: NotificationCategory.SYSTEM,
      priority,
      metadata,
    });
  }

  async createSecurityNotification(
    title: string,
    message: string,
    userId?: string,
    userName?: string,
    metadata?: Record<string, any>,
  ): Promise<AdminNotification> {
    return await this.createAdminNotification({
      title,
      message,
      type: NotificationType.WARNING,
      category: NotificationCategory.SECURITY,
      priority: NotificationPriority.URGENT,
      userId,
      userName,
      metadata,
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
      metadata: { transactionId },
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
      metadata: { disputeId },
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
}