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
import { Injectable, UseGuards, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  user?: any;
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  private connectedUsers = new Map<string, string[]>(); // userId -> socketIds
  // For test verification: keep a simple map of last notification per user
  private lastNotificationByUser = new Map<string, any>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const authTokenRaw = client.handshake.auth?.token as string | undefined;
      const authToken = authTokenRaw && authTokenRaw.startsWith('Bearer ')
        ? authTokenRaw.slice(7)
        : authTokenRaw;
      const headerAuth = client.handshake.headers?.authorization as string | undefined;
      const headerToken = headerAuth && headerAuth.startsWith('Bearer ')
        ? headerAuth.split(' ')[1]
        : undefined;
      const token = authToken || headerToken;

      const secretUsed = process.env.JWT_SECRET || 'bricola_secret_key';
      this.logger.log(
        `WS auth: got token from ${authToken ? 'auth' : headerToken ? 'header' : 'none'}; ` +
        `preview=${token ? token.substring(0, 12) + '...' : 'none'}; ` +
        `hasBearerHeader=${headerAuth ? headerAuth.startsWith('Bearer ') : false}; ` +
        `hadBearerInAuth=${authTokenRaw ? authTokenRaw.startsWith('Bearer ') : false}; ` +
        `secretUsed=${secretUsed ? (secretUsed.substring(0, 6) + '...') : 'undefined'}`,
      );
      if (!token) {
        client.disconnect();
        return;
      }

      // Decode token to inspect payload prior to verification
      const decoded: any = this.jwtService.decode(token) || {};
      this.logger.log(
        `WS token decode: sub=${decoded?.sub ?? 'none'}; isAdmin=${decoded?.isAdmin ?? 'n/a'}; ` +
        `iat=${decoded?.iat ?? 'n/a'}; exp=${decoded?.exp ?? 'n/a'}`,
      );

      // Verify explicitly with known secret to avoid module misconfig surprises
      const payload = this.jwtService.verify(token, { secret: secretUsed });
      client.userId = payload.sub;
      client.user = payload;

      // Ensure userId is defined before using it
      if (!client.userId) {
        client.disconnect();
        return;
      }

      const userSockets = this.connectedUsers.get(client.userId) || [];
      userSockets.push(client.id);
      this.connectedUsers.set(client.userId, userSockets);

      client.join(`user_${client.userId}`);
      
      // Send unread notifications count
      const unreadCount = await this.notificationsService.getUnreadCount(client.userId);
      client.emit('unread_count', { count: unreadCount });
      
      this.logger.log(`User ${client.userId} connected with socket ${client.id}`);
    } catch (error) {
      this.logger.error(
        `Connection error: name=${error?.name} msg=${error?.message} stack=${error?.stack?.split('\n')[0]}`,
      );
      try {
        const rawAuth = client.handshake?.auth?.token || '';
        const rawHeader = client.handshake?.headers?.authorization || '';
        this.logger.error(
          `Token debug: authTokenPreview=${rawAuth ? rawAuth.substring(0, 12) + '...' : 'none'}; ` +
          `headerAuthPreview=${rawHeader ? rawHeader.substring(0, 20) + '...' : 'none'}; ` +
          `hasDots=${(rawAuth || rawHeader).includes('.')}`,
        );
      } catch {}
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      const userSockets = this.connectedUsers.get(client.userId) || [];
      const updatedSockets = userSockets.filter(socketId => socketId !== client.id);
      
      if (updatedSockets.length === 0) {
        this.connectedUsers.delete(client.userId);
      } else {
        this.connectedUsers.set(client.userId, updatedSockets);
      }
      
      this.logger.log(`User ${client.userId} disconnected socket ${client.id}`);
    }
  }

  @SubscribeMessage('get_notifications')
  async handleGetNotifications(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!client.userId) return;
    
    const notifications = await this.notificationsService.findByUserId(client.userId);
    const unreadCount = await this.notificationsService.getUnreadCount(client.userId);
    
    client.emit('notifications', { notifications, unreadCount });
  }

  @SubscribeMessage('mark_as_read')
  async handleMarkAsRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { notificationId: string },
  ) {
    if (!client.userId) return;
    
    await this.notificationsService.markAsRead(data.notificationId, client.userId);
    const unreadCount = await this.notificationsService.getUnreadCount(client.userId);
    
    client.emit('unread_count', { count: unreadCount });
  }

  @SubscribeMessage('mark_all_as_read')
  async handleMarkAllAsRead(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!client.userId) return;
    
    await this.notificationsService.markAllAsRead(client.userId);
    client.emit('unread_count', { count: 0 });
  }

  // Method to send notification to specific user
  async sendNotificationToUser(userId: string, notification: any) {
    this.server.to(`user_${userId}`).emit('new_notification', notification);
    // Track last notification to allow verification in tests
    this.lastNotificationByUser.set(userId, notification);
    
    // Update unread count
    const unreadCount = await this.notificationsService.getUnreadCount(userId);
    this.server.to(`user_${userId}`).emit('unread_count', { count: unreadCount });
  }

  // Method to broadcast notification to all connected users
  broadcastNotification(notification: any) {
    this.server.emit('broadcast_notification', notification);
  }

  // Expose a lightweight getter for tests
  getLastNotificationForUser(userId: string) {
    return this.lastNotificationByUser.get(userId);
  }
}