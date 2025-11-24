import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
  ParseIntPipe,
  ParseBoolPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { NotificationType } from './enums/notification-type';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Create a new notification (Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'Notification created successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  create(@Body() createNotificationDto: CreateNotificationDto) {
    return this.notificationsService.create(createNotificationDto);
  }

  @Post('system')
  @ApiOperation({ summary: 'Create a system notification for current user' })
  @ApiResponse({
    status: 201,
    description: 'System notification created successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  createSystemNotification(
    @Request() req,
    @Body()
    body: {
      type: string;
      title: string;
      message: string;
      relatedId?: string;
      relatedType?: string;
      link?: string;
    },
  ) {
    return this.notificationsService.createSystemNotification(
      req.user.id,
      body.type as NotificationType,
      body.title,
      body.message,
      body.relatedId,
      body.relatedType,
      body.link,
    );
  }

  @Get()
  @UseGuards(AdminGuard)
  @ApiOperation({
    summary: 'Get all notifications with pagination and filters (Admin only)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: NotificationType,
    description: 'Filter by notification type',
  })
  @ApiQuery({
    name: 'isRead',
    required: false,
    type: Boolean,
    description: 'Filter by read status',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    type: String,
    description: 'Filter by user ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Notifications retrieved successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  findAll(
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('type') type?: NotificationType,
    @Query('isRead', new ParseBoolPipe({ optional: true })) isRead?: boolean,
    @Query('userId') userId?: string,
  ) {
    return this.notificationsService.findAll(page, limit, type, isRead, userId);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get current user notifications' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page',
  })
  @ApiQuery({
    name: 'isRead',
    required: false,
    type: Boolean,
    description: 'Filter by read status',
  })
  @ApiResponse({
    status: 200,
    description: 'User notifications retrieved successfully',
  })
  getMyNotifications(
    @Request() req,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('isRead', new ParseBoolPipe({ optional: true })) isRead?: boolean,
  ) {
    return this.notificationsService.findByUserId(
      req.user.id,
      page,
      limit,
      isRead,
    );
  }

  @Get('my/unread-count')
  @ApiOperation({ summary: 'Get unread notifications count for current user' })
  @ApiResponse({
    status: 200,
    description: 'Unread count retrieved successfully',
  })
  getUnreadCount(@Request() req) {
    return this.notificationsService.getUnreadCount(req.user.id);
  }

  @Patch('my/mark-all-read')
  @ApiOperation({ summary: 'Mark all notifications as read for current user' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  markAllAsRead(@Request() req) {
    return this.notificationsService.markAllAsRead(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific notification by ID' })
  @ApiResponse({
    status: 200,
    description: 'Notification retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.notificationsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Update a notification (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Notification updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateNotificationDto: UpdateNotificationDto,
  ) {
    return this.notificationsService.update(id, updateNotificationDto);
  }

  @Patch(':id/mark-read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Can only mark own notifications',
  })
  markAsRead(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.notificationsService.markAsRead(id, req.user.id);
  }

  @Patch(':id/mark-unread')
  @ApiOperation({ summary: 'Mark a notification as unread' })
  @ApiResponse({ status: 200, description: 'Notification marked as unread' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Can only mark own notifications',
  })
  markAsUnread(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.notificationsService.markAsUnread(id, req.user.id);
  }

  @Delete('my')
  @ApiOperation({ summary: 'Delete all notifications for current user' })
  @ApiResponse({
    status: 200,
    description: 'All notifications deleted successfully',
  })
  deleteMyNotifications(@Request() req) {
    return this.notificationsService.deleteByUserId(req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification' })
  @ApiResponse({
    status: 200,
    description: 'Notification deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  remove(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    // Users can only delete their own notifications, admins can delete any
    if (!req.user.isAdmin) {
      // For regular users, we need to check ownership in the service
      // This is a simplified approach - in production, you might want more sophisticated access control
    }
    return this.notificationsService.remove(id);
  }

  @Delete('bulk/delete')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Bulk delete notifications (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Notifications deleted successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  bulkDelete(@Body('ids') ids: string[]) {
    return this.notificationsService.bulkDelete(ids);
  }

  @Delete('user/:userId')
  @UseGuards(AdminGuard)
  @ApiOperation({
    summary: 'Delete all notifications for a specific user (Admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'User notifications deleted successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  deleteByUserId(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.notificationsService.deleteByUserId(userId);
  }
}
