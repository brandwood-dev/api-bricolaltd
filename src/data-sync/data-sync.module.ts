import { Module } from '@nestjs/common';
import { DataSyncGateway } from './data-sync.gateway';
import { DataSyncService } from './data-sync.service';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [JwtModule.register({})],
  providers: [DataSyncGateway, DataSyncService],
  exports: [DataSyncService],
})
export class DataSyncModule {}
