import { Module } from '@nestjs/common';
import { S3Module } from './services/s3.module';

@Module({
  imports: [S3Module],
  exports: [S3Module],
})
export class CommonModule {}
