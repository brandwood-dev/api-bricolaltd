import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { News } from './entities/news.entity';
import { NewsService } from './news.service';
import { NewsController } from './news.controller';
import { UsersModule } from '../users/users.module';
import { S3Module } from '../common/services/s3.module';
import { NewsFileUploadMiddleware } from '../common/middlewares/news-file-upload.middleware';
import { CategoriesModule } from '../categories/categories.module';

@Module({
  imports: [TypeOrmModule.forFeature([News]), UsersModule, S3Module, CategoriesModule],
  controllers: [NewsController],
  providers: [NewsService],
  exports: [NewsService],
})
export class NewsModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(NewsFileUploadMiddleware)
      .forRoutes(
        { path: 'news', method: RequestMethod.POST },
        { path: 'news/:id', method: RequestMethod.PATCH },
      );
  }
}
