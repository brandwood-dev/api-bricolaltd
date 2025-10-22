import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tool } from './entities/tool.entity';
import { ToolPhoto } from './entities/tool-photo.entity';
import { ReviewTool } from '../reviews/entities/review-tool.entity';
import { Currency } from '../users/entities/currency.entity';
import { ToolsService } from './tools.service';
import { ToolsController } from './tools.controller';
import { ToolPhotosController } from './controllers/tool-photos.controller';
import { UsersModule } from '../users/users.module';
import { S3Module } from '../common/services/s3.module';
import { FileUploadMiddleware } from '../common/middlewares/file-upload.middleware';

@Module({
  imports: [TypeOrmModule.forFeature([Tool, ToolPhoto, ReviewTool, Currency]), UsersModule, S3Module],
  controllers: [ToolsController, ToolPhotosController],
  providers: [ToolsService],
  exports: [ToolsService],
})
export class ToolsModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(
        FileUploadMiddleware.register({
          fieldName: 'files',
          maxCount: 10,
          isMultiple: true,
        }),
      )
      .forRoutes(
        { path: 'tools', method: RequestMethod.POST },
        { path: 'tools/:id', method: RequestMethod.PATCH },
      );

    consumer
      .apply(
        FileUploadMiddleware.register({
          fieldName: 'file',
          maxCount: 1,
          isMultiple: false,
        }),
      )
      .forRoutes({ path: 'tool-photos', method: RequestMethod.POST });
  }
}
