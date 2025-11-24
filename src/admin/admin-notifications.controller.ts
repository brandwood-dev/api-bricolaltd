import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Query,
  UseGuards,
  Param,
} from '@nestjs/common';
import {
  NotificationType,
  NotificationCategory,
  NotificationPriority,
} from './dto/admin-notifications.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { EnhancedAdminGuard } from '../auth/guards/enhanced-admin.guard';
import { AdminPermissions } from '../auth/decorators/admin-permissions.decorator';
import { AdminNotificationsService } from './admin-notifications.service';
import {
  CreateAdminNotificationDto,
  MarkNotificationsReadDto,
  DeleteNotificationsDto,
} from './dto/admin-notifications.dto';

@ApiTags('Admin Notifications')
@Controller('admin/notifications')
@UseGuards(EnhancedAdminGuard)
@ApiBearerAuth()
export class AdminNotificationsController {
  constructor(
    private readonly adminNotificationsService: AdminNotificationsService,
  ) {}

  @Get()
  @AdminPermissions('manage_notifications')
  @ApiOperation({ summary: 'Get all admin notifications' })
  @ApiResponse({
    status: 200,
    description: 'Admin notifications retrieved successfully',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'type', required: false, type: String })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'isRead', required: false, type: Boolean })
  @ApiQuery({ name: 'priority', required: false, type: String })
  async getAdminNotifications(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
    @Query('type') type?: string,
    @Query('category') category?: string,
    @Query('isRead') isRead?: boolean,
    @Query('priority') priority?: string,
  ) {
    const notifications =
      await this.adminNotificationsService.getAdminNotifications({
        page,
        limit,
        type: type as NotificationType,
        category: category as NotificationCategory,
        isRead,
        priority: priority as NotificationPriority,
      });

    return {
      data: notifications,
      message: 'Admin notifications retrieved successfully',
    };
  }

  @Get('unread-count')
  @AdminPermissions('manage_notifications')
  @ApiOperation({ summary: 'Get unread notifications count' })
  @ApiResponse({
    status: 200,
    description: 'Unread count retrieved successfully',
  })
  async getUnreadCount() {
    const count = await this.adminNotificationsService.getUnreadCount();

    return {
      data: { count },
      message: 'Unread count retrieved successfully',
    };
  }

  @Post()
  @AdminPermissions('manage_notifications')
  @ApiOperation({ summary: 'Create admin notification' })
  @ApiResponse({
    status: 201,
    description: 'Admin notification created successfully',
  })
  @ApiBody({ type: CreateAdminNotificationDto })
  async createAdminNotification(
    @Body() createNotificationDto: CreateAdminNotificationDto,
  ) {
    const notification =
      await this.adminNotificationsService.createAdminNotification(
        createNotificationDto,
      );

    return {
      data: notification,
      message: 'Admin notification created successfully',
    };
  }

  // Test endpoints to verify notifications pipeline (WS + email on critical)
  @Post('test/basic')
  @AdminPermissions('manage_notifications')
  @ApiOperation({ summary: 'Create a basic test admin notification' })
  @ApiResponse({
    status: 201,
    description: 'Test notification created successfully',
  })
  async createBasicTestNotification() {
    const notification =
      await this.adminNotificationsService.createAdminNotification({
        title: 'Test Notification',
        message: 'This is a test admin notification to verify WS delivery.',
        type: NotificationType.INFO,
        priority: NotificationPriority.MEDIUM,
        category: NotificationCategory.SYSTEM,
      });

    return {
      data: notification,
      message: 'Test notification created successfully',
    };
  }

  @Post('test/critical')
  @AdminPermissions('manage_notifications')
  @ApiOperation({
    summary: 'Create a critical test admin notification (emails expected)',
  })
  @ApiResponse({
    status: 201,
    description: 'Critical test notification created successfully',
  })
  async createCriticalTestNotification() {
    const notification =
      await this.adminNotificationsService.createAdminNotification({
        title: 'Critical Test Notification',
        message: 'This is a critical test notification to verify email alerts.',
        type: NotificationType.ERROR,
        priority: NotificationPriority.URGENT,
        category: NotificationCategory.SECURITY,
      });

    return {
      data: notification,
      message: 'Critical test notification created successfully',
    };
  }

  @Patch('mark-read')
  @AdminPermissions('manage_notifications')
  @ApiOperation({ summary: 'Mark notifications as read' })
  @ApiResponse({
    status: 200,
    description: 'Notifications marked as read successfully',
  })
  @ApiBody({ type: MarkNotificationsReadDto })
  async markNotificationsAsRead(@Body() markReadDto: MarkNotificationsReadDto) {
    await this.adminNotificationsService.markNotificationsAsRead(
      markReadDto.notificationIds,
    );

    return {
      data: null,
      message: 'Notifications marked as read successfully',
    };
  }

  @Patch(':id/read')
  @AdminPermissions('manage_notifications')
  @ApiOperation({ summary: 'Mark single notification as read' })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as read successfully',
  })
  async markSingleAsRead(@Param('id') id: string) {
    await this.adminNotificationsService.markNotificationsAsRead([id]);

    return {
      data: null,
      message: 'Notification marked as read successfully',
    };
  }

  @Delete()
  @AdminPermissions('manage_notifications')
  @ApiOperation({ summary: 'Delete multiple notifications' })
  @ApiResponse({
    status: 200,
    description: 'Notifications deleted successfully',
  })
  @ApiBody({ type: DeleteNotificationsDto })
  async deleteNotifications(@Body() deleteDto: DeleteNotificationsDto) {
    await this.adminNotificationsService.deleteNotifications(
      deleteDto.notificationIds,
    );

    return {
      data: null,
      message: 'Notifications deleted successfully',
    };
  }

  @Delete(':id')
  @AdminPermissions('manage_notifications')
  @ApiOperation({ summary: 'Delete single notification' })
  @ApiResponse({
    status: 200,
    description: 'Notification deleted successfully',
  })
  async deleteSingleNotification(@Param('id') id: string) {
    await this.adminNotificationsService.deleteNotifications([id]);

    return {
      data: null,
      message: 'Notification deleted successfully',
    };
  }

  @Post('broadcast')
  @AdminPermissions('manage_notifications')
  @ApiOperation({ summary: 'Broadcast notification to all admins' })
  @ApiResponse({
    status: 201,
    description: 'Notification broadcasted successfully',
  })
  @ApiBody({ type: CreateAdminNotificationDto })
  async broadcastNotification(
    @Body() notificationDto: CreateAdminNotificationDto,
  ) {
    await this.adminNotificationsService.broadcastToAllAdmins(notificationDto);

    return {
      data: null,
      message: 'Notification broadcasted to all admins successfully',
    };
  }

  @Patch('mark-all-read')
  @AdminPermissions('manage_notifications')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({
    status: 200,
    description: 'All notifications marked as read successfully',
  })
  async markAllAsRead() {
    await this.adminNotificationsService.markAllAsRead();

    return {
      data: null,
      message: 'All notifications marked as read successfully',
    };
  }
}
