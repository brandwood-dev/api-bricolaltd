import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { PushDeviceToken } from './entities/push-device-token.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { NotificationType } from './enums/notification-type';
import { NotificationDispatcherService } from './notification-dispatcher.service';

type NotificationTranslationParams = Record<
  string,
  string | number | boolean
>;

type NotificationI18nMetadata = {
  titleKey?: string;
  messageKey?: string;
  translationParams?: NotificationTranslationParams;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    @InjectRepository(PushDeviceToken)
    private pushDeviceTokenRepository: Repository<PushDeviceToken>,
    @Inject(forwardRef(() => NotificationDispatcherService))
    private notificationDispatcherService: NotificationDispatcherService,
  ) {}

  async create(
    createNotificationDto: CreateNotificationDto,
  ): Promise<Notification> {
    const notification = this.notificationRepository.create(
      createNotificationDto,
    );
    const savedNotification = await this.notificationRepository.save(notification);

    if (savedNotification.userId) {
      try {
        const unreadCount = await this.getUnreadCount(savedNotification.userId);
        await this.notificationDispatcherService.dispatchNotification(
          savedNotification,
          unreadCount,
        );
      } catch (error) {
        this.logger.warn(
          `Notification dispatch failed for ${savedNotification.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return savedNotification;
  }

  async registerPushToken(
    userId: string,
    input: {
      token: string;
      deviceId?: string;
      platform?: string;
    },
  ): Promise<PushDeviceToken> {
    const normalizedToken = String(input.token ?? '').trim();
    if (!normalizedToken) {
      throw new NotFoundException('Push token is required');
    }

    const existing = await this.pushDeviceTokenRepository.findOne({
      where: { expoPushToken: normalizedToken },
    });

    if (existing) {
      const previousUserId = existing.userId;
      const ownerChanged = String(existing.userId ?? '') !== String(userId ?? '');
      existing.userId = userId;
      existing.deviceId = input.deviceId?.trim() || existing.deviceId || null;
      existing.platform = input.platform?.trim() || existing.platform || null;
      existing.isActive = true;
      existing.lastRegisteredAt = new Date();
      existing.lastError = null;
      const saved = await this.pushDeviceTokenRepository.save(existing);

      if (ownerChanged) {
        this.logger.warn(
          `[push] Token owner changed: token ${normalizedToken.slice(0, 18)}... moved from user ${previousUserId ?? 'none'} to user ${userId ?? 'unknown'}`,
        );
      }

      return saved;
    }

    const token = this.pushDeviceTokenRepository.create({
      userId,
      expoPushToken: normalizedToken,
      deviceId: input.deviceId?.trim() || null,
      platform: input.platform?.trim() || null,
      isActive: true,
      lastRegisteredAt: new Date(),
      lastError: null,
    });

    return await this.pushDeviceTokenRepository.save(token);
  }

  async unregisterPushToken(userId: string, token: string): Promise<void> {
    const normalizedToken = String(token ?? '').trim();
    if (!normalizedToken) return;

    // The Expo push token is global to the device and can be re-attributed to
    // a different userId if an account switch happens on the same phone.
    // So we match by token first, not by userId + token. Otherwise an old
    // owner would fail to disable the row during logout.
    const existing = await this.pushDeviceTokenRepository.findOne({
      where: { expoPushToken: normalizedToken },
    });

    if (!existing) {
      this.logger.warn(
        `[push] Unregister requested for user ${userId} but token ${normalizedToken.slice(0, 18)}... was not found in storage`,
      );
      return;
    }

    const matchedUserId = String(existing.userId ?? '');
    const belongsToCaller =
      matchedUserId.length > 0 &&
      matchedUserId === String(userId ?? '');

    await this.pushDeviceTokenRepository.update(existing.id, {
      isActive: false,
    });

    this.logger.log(
      `[push] Token unregistered for user ${userId}: token=${normalizedToken.slice(0, 18)}... tokenRowId=${existing.id} matchedOwner=${belongsToCaller} previousOwner=${existing.userId}`,
    );
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    type?: NotificationType,
    isRead?: boolean,
    userId?: string,
  ): Promise<{
    data: Notification[];
    total: number;
    page: number;
    limit: number;
  }> {
    const options: FindManyOptions<Notification> = {
      relations: ['user'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    };

    if (type || isRead !== undefined || userId) {
      options.where = {};
      if (type) options.where.type = type;
      if (isRead !== undefined) options.where.isRead = isRead;
      if (userId) options.where.userId = userId;
    }

    const [data, total] =
      await this.notificationRepository.findAndCount(options);

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async findOne(id: string): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!notification) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }

    return notification;
  }

  async findByUserId(
    userId: string,
    page: number = 1,
    limit: number = 10,
    isRead?: boolean,
  ): Promise<{
    data: Notification[];
    total: number;
    page: number;
    limit: number;
  }> {
    const options: FindManyOptions<Notification> = {
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    };

    if (isRead !== undefined) {
      options.where = { ...options.where, isRead };
    }

    const [data, total] =
      await this.notificationRepository.findAndCount(options);

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async update(
    id: string,
    updateNotificationDto: UpdateNotificationDto,
  ): Promise<Notification> {
    const notification = await this.findOne(id);

    // If marking as read, set readAt timestamp
    if (updateNotificationDto.isRead === true && !notification.isRead) {
      updateNotificationDto.readAt = new Date();
    }
    // If marking as unread, clear readAt timestamp
    else if (updateNotificationDto.isRead === false) {
      updateNotificationDto.readAt = undefined; // Use undefined instead of null
    }

    Object.assign(notification, updateNotificationDto);
    return await this.notificationRepository.save(notification);
  }

  async remove(id: string): Promise<void> {
    const notification = await this.findOne(id);
    await this.notificationRepository.remove(notification);
  }

  async markAsRead(id: string, userId?: string): Promise<Notification> {
    const notification = await this.findOne(id);

    // If userId is provided, ensure the notification belongs to the user
    if (userId && notification.userId !== userId) {
      throw new ForbiddenException(
        'You can only mark your own notifications as read',
      );
    }

    return await this.update(id, { isRead: true });
  }

  async markAsUnread(id: string, userId?: string): Promise<Notification> {
    const notification = await this.findOne(id);

    // If userId is provided, ensure the notification belongs to the user
    if (userId && notification.userId !== userId) {
      throw new ForbiddenException(
        'You can only mark your own notifications as unread',
      );
    }

    return await this.update(id, { isRead: false });
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepository.update(
      { userId, isRead: false },
      { isRead: true, readAt: new Date() },
    );
  }

  async getUnreadCount(userId: string): Promise<number> {
    return await this.notificationRepository.count({
      where: {
        userId,
        isRead: false,
      },
    });
  }

  async bulkDelete(ids: string[]): Promise<void> {
    await this.notificationRepository.delete(ids);
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.notificationRepository.delete({ userId });
  }

  // Helper method to create system notifications
  async createSystemNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    relatedId?: string,
    relatedType?: string,
    link?: string,
    i18n?: NotificationI18nMetadata,
  ): Promise<Notification> {
    return await this.create({
      userId,
      type,
      title,
      message,
      titleKey: i18n?.titleKey,
      messageKey: i18n?.messageKey,
      translationParams: i18n?.translationParams,
      isSystem: true,
      relatedId,
      relatedType,
      link,
    });
  }
}
