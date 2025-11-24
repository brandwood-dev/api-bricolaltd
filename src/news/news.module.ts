import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { News } from './entities/news.entity';
import { Section } from './entities/section.entity';
import { SectionParagraph } from './entities/section-paragraph.entity';
import { SectionImage } from './entities/section-image.entity';
import { NewsService } from './news.service';
import { NewsController } from './news.controller';
import { SectionsService } from './sections.service';
import { SectionsController } from './sections.controller';
import { BlogShareController } from './blog-share.controller';
import { UsersModule } from '../users/users.module';
import { S3Module } from '../common/services/s3.module';
import { NewsFileUploadMiddleware } from '../common/middlewares/news-file-upload.middleware';
import { CategoriesModule } from '../categories/categories.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([News, Section, SectionParagraph, SectionImage]),
    UsersModule,
    S3Module,
    CategoriesModule,
  ],
  controllers: [NewsController, SectionsController, BlogShareController],
  providers: [NewsService, SectionsService],
  exports: [NewsService, SectionsService],
})
export class NewsModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(NewsFileUploadMiddleware)
      .forRoutes(
        { path: 'news', method: RequestMethod.POST },
        { path: 'news/:id', method: RequestMethod.PATCH },
        { path: 'sections/:id/images/upload', method: RequestMethod.POST },
      );
  }
}
