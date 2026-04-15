import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

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
  namespace: '/data-sync',
})
export class DataSyncGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(DataSyncGateway.name);
  private connectedUsers = new Map<string, string[]>(); // userId -> socketIds

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const authTokenRaw = client.handshake.auth?.token as string | undefined;
      const authToken =
        authTokenRaw && authTokenRaw.startsWith('Bearer ')
          ? authTokenRaw.slice(7)
          : authTokenRaw;
      const headerAuth = client.handshake.headers?.authorization;
      const headerToken =
        headerAuth && headerAuth.startsWith('Bearer ')
          ? headerAuth.split(' ')[1]
          : undefined;
      const token = authToken || headerToken;

      const secretUsed = process.env.JWT_SECRET || 'bricola_secret_key';
      
      // If no token, we can still allow connection for public data broadcasts
      if (!token) {
        this.logger.log(`Anonymous user connected to data-sync socket ${client.id}`);
        client.join('public'); // Join public room for global events like tool updates
        return;
      }

      // Verify token
      const payload = this.jwtService.verify(token, { secret: secretUsed });
      client.userId = payload.sub;
      client.user = payload;

      if (client.userId) {
        const userSockets = this.connectedUsers.get(client.userId) || [];
        userSockets.push(client.id);
        this.connectedUsers.set(client.userId, userSockets);

        // Join both personal room and public room
        client.join(`user_${client.userId}`);
        client.join('public');

        this.logger.log(`User ${client.userId} connected to data-sync socket ${client.id}`);
      } else {
        client.join('public');
      }
    } catch (error) {
      // If token fails, just treat as anonymous public connection instead of disconnecting
      this.logger.warn(`DataSync connection auth failed, fallback to anonymous: ${error?.message}`);
      client.join('public');
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      const userSockets = this.connectedUsers.get(client.userId) || [];
      const updatedSockets = userSockets.filter(
        (socketId) => socketId !== client.id,
      );

      if (updatedSockets.length === 0) {
        this.connectedUsers.delete(client.userId);
      } else {
        this.connectedUsers.set(client.userId, updatedSockets);
      }

      this.logger.log(`User ${client.userId} disconnected data-sync socket ${client.id}`);
    } else {
      this.logger.log(`Anonymous user disconnected data-sync socket ${client.id}`);
    }
  }
}
