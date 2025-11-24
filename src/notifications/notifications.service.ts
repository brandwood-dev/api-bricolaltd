import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { NotificationType } from './enums/notification-type';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
  ) {}

  async create(
    createNotificationDto: CreateNotificationDto,
  ): Promise<Notification> {
    const notification = this.notificationRepository.create(
      createNotificationDto,
    );
    return await this.notificationRepository.save(notification);
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
  ): Promise<Notification> {
    return await this.create({
      userId,
      type,
      title,
      message,
      isSystem: true,
      relatedId,
      relatedType,
      link,
    });
  }
}
