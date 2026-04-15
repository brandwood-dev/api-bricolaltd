import { Injectable, Logger } from '@nestjs/common';
import { DataSyncGateway } from './data-sync.gateway';

@Injectable()
export class DataSyncService {
  private readonly logger = new Logger(DataSyncService.name);

  constructor(private readonly dataSyncGateway: DataSyncGateway) {}

  /**
   * Emit an event to a specific user (e.g., booking updates)
   */
  emitToUser(userId: string, event: string, data: any) {
    this.logger.log(`Emitting ${event} to user ${userId}`);
    this.dataSyncGateway.server.to(`user_${userId}`).emit(event, data);
  }

  /**
   * Broadcast an event to everyone (e.g., tool availability changes)
   */
  broadcast(event: string, data: any) {
    this.logger.log(`Broadcasting ${event}`);
    this.dataSyncGateway.server.emit(event, data);
  }
}
