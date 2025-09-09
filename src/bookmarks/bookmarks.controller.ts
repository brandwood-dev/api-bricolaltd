import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { BookmarksService } from './bookmarks.service';
import { CreateBookmarkDto } from './dto/create-bookmark.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

@ApiTags('bookmarks')
@Controller('bookmarks')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BookmarksController {
  constructor(private readonly bookmarksService: BookmarksService) {}

  //list bookmarks
  @Get('user/:userId')
  @ApiOperation({ summary: 'Get bookmarks by user id' })
  @ApiResponse({ status: 200, description: 'Return the bookmarks.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  findByUser(@Param('userId') userId: string) {
    console.log('🎯 BookmarksController.findByUser - Requête GET reçue pour userId:', userId);
    return this.bookmarksService.findByUser(userId);
  }

  //remove bookmark
  @Delete('user/:userId/tool/:toolId')
  @ApiOperation({ summary: 'Delete a tool from bookmarks' })
  @ApiResponse({
    status: 200,
    description: 'The bookmark has been successfully deleted.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  removeByUserAndTool(
    @Param('userId') userId: string,
    @Param('toolId') toolId: string,
  ) {
    console.log('🎯 BookmarksController.removeByUserAndTool - Requête DELETE reçue userId:', userId, 'toolId:', toolId);
    return this.bookmarksService.removeByUserAndTool(userId, toolId);
  }

  //create bookmark
  @Post('')
  @ApiOperation({ summary: 'Add a tool to bookmarks' })
  @ApiResponse({
    status: 200,
    description: 'The bookmark has been successfully created.',
  })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  async create(@Body() createBookmarkDto: CreateBookmarkDto) {
    console.log('🎯 BookmarksController.create - Requête POST reçue avec body:', createBookmarkDto);
    const result = await this.bookmarksService.create(createBookmarkDto);
    console.log('🎯 BookmarksController.create - Résultat retourné:', result);
    return result;
  }
}
