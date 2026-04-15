import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bookmark } from './entities/bookmark.entity';
import { BookmarksService } from './bookmarks.service';
import { BookmarksController } from './bookmarks.controller';
import { UsersModule } from '../users/users.module';
import { ToolsModule } from '../tools/tools.module';
import { DataSyncModule } from '../data-sync/data-sync.module';

@Module({
  imports: [TypeOrmModule.forFeature([Bookmark]), UsersModule, ToolsModule, DataSyncModule],
  controllers: [BookmarksController],
  providers: [BookmarksService],
  exports: [BookmarksService],
})
export class BookmarksModule {}
