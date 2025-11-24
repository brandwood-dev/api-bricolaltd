import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThreeDSecureService } from './three-d-secure.service';
import { ThreeDSecureController } from './three-d-secure.controller';
import { ThreeDSecureSession } from './entities/three-d-secure-session.entity';
import { AdminModule } from '../../admin/admin.module';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([ThreeDSecureSession]),
    forwardRef(() => AdminModule),
  ],
  controllers: [ThreeDSecureController],
  providers: [ThreeDSecureService, ConfigService],
  exports: [ThreeDSecureService],
})
export class ThreeDSecureModule {}
