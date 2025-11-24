import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AdminNotificationsService } from '../admin/admin-notifications.service';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  user?: any;
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: process.env.ADMIN_FRONTEND_URL || 'http://localhost:8080',
    credentials: true,
  },
  namespace: '/admin-notifications',
})
export class AdminNotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AdminNotificationsGateway.name);
  private connectedAdmins = new Map<string, string[]>(); // adminId -> socketIds
  private adminNotificationsService: AdminNotificationsService;

  constructor(
    private readonly jwtService: JwtService,
    @Inject(forwardRef(() => AdminNotificationsService))
    adminNotificationsService: AdminNotificationsService,
  ) {
    this.adminNotificationsService = adminNotificationsService;
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token =
        client.handshake.auth.token ||
        client.handshake.headers.authorization?.split(' ')[1];
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      // Require admin privileges
      if (!payload?.isAdmin) {
        this.logger.warn('Non-admin attempted admin WS connection');
        client.disconnect();
        return;
      }

      client.userId = payload.sub;
      client.user = payload;

      if (!client.userId) {
        client.disconnect();
        return;
      }

      const adminSockets = this.connectedAdmins.get(client.userId) || [];
      adminSockets.push(client.id);
      this.connectedAdmins.set(client.userId, adminSockets);

      // Join per-admin room and a common admins room
      client.join(`admin_${client.userId}`);
      client.join('admins');

      // Initial unread count for admin notifications (fallback to 0)
      const unreadCount =
        (await this.adminNotificationsService?.getUnreadCount()) ?? 0;
      client.emit('unread_count', { count: unreadCount });

      this.logger.log(
        `Admin ${client.userId} connected with socket ${client.id}`,
      );
    } catch (error) {
      this.logger.error('Admin connection error:', error);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      const adminSockets = this.connectedAdmins.get(client.userId) || [];
      const updatedSockets = adminSockets.filter(
        (socketId) => socketId !== client.id,
      );

      if (updatedSockets.length === 0) {
        this.connectedAdmins.delete(client.userId);
      } else {
        this.connectedAdmins.set(client.userId, updatedSockets);
      }

      this.logger.log(
        `Admin ${client.userId} disconnected socket ${client.id}`,
      );
    }
  }

  // Admin pulls latest notifications with optional basic pagination (defaults inside service)
  @SubscribeMessage('get_notifications')
  async handleGetAdminNotifications(
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.userId) return;

    const { notifications, pagination } =
      await this.adminNotificationsService.getAdminNotifications({
        page: 1,
        limit: 10,
      });
    const unreadCount = await this.adminNotificationsService.getUnreadCount();
    // reuse same event names to ease client integration
    client.emit('notifications', {
      notifications: { data: notifications },
      unreadCount,
    });
  }

  // Admin marks specific notification as read
  @SubscribeMessage('mark_as_read')
  async handleAdminMarkAsRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { notificationId: string },
  ) {
    if (!client.userId) return;
    if (!this.adminNotificationsService) {
      this.logger.warn('AdminNotificationsService not initialized');
      return;
    }

    await this.adminNotificationsService.markNotificationsAsRead([
      data.notificationId,
    ]);
    const unreadCount = await this.adminNotificationsService.getUnreadCount();
    client.emit('unread_count', { count: unreadCount });
  }

  // Admin marks all notifications as read (global)
  @SubscribeMessage('mark_all_as_read')
  async handleAdminMarkAllAsRead(
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.userId) return;
    if (!this.adminNotificationsService) {
      this.logger.warn('AdminNotificationsService not initialized');
      return;
    }

    await this.adminNotificationsService.markAllAsRead();
    client.emit('unread_count', { count: 0 });
  }

  // Broadcast a notification to all connected admins
  broadcastAdminNotification(notification: any) {
    this.server.to('admins').emit('new_notification', notification);
  }

  // Emit unread count update to all admins
  async broadcastUnreadCountUpdate() {
    if (!this.adminNotificationsService) {
      return;
    }
    const unreadCount = await this.adminNotificationsService.getUnreadCount();
    this.server.to('admins').emit('unread_count', { count: unreadCount });
  }
}
