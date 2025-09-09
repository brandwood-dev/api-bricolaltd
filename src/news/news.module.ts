import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { News } from './entities/news.entity';
import { NewsService } from './news.service';
import { NewsController } from './news.controller';
import { UsersModule } from '../users/users.module';
import { S3Module } from '../common/services/s3.module';
import { FileUploadMiddleware } from '../common/middlewares/file-upload.middleware';

@Module({
  imports: [TypeOrmModule.forFeature([News]), UsersModule, S3Module],
  controllers: [NewsController],
  providers: [NewsService],
  exports: [NewsService],
})
export class NewsModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(
        FileUploadMiddleware.register({
          fieldName: 'files',
          maxCount: 5,
          isMultiple: true,
        }),
      )
      .forRoutes(
        { path: 'news', method: RequestMethod.POST },
        { path: 'news/:id', method: RequestMethod.PATCH },
      );
  }
}
