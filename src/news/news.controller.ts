import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Req,
} from '@nestjs/common';
import { NewsService } from './news.service';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
} from '@nestjs/swagger';

@ApiTags('news')
@Controller('news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new news article' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 201,
    description: 'The news article has been successfully created.',
  })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  create(@Body() createNewsDto: CreateNewsDto, @Req() req: any) {
    // The files are attached to the request by the FileUploadMiddleware
    const files = req.files;
    return this.newsService.create(createNewsDto, files);
  }

  @Get()
  @ApiOperation({ summary: 'Get all news articles' })
  @ApiResponse({ status: 200, description: 'Return all news articles.' })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search term for news title',
  })
  @ApiQuery({
    name: 'isPublic',
    required: false,
    description: 'Filter by public status',
    type: Boolean,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number for pagination',
    type: Number,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of items per page',
    type: Number,
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    description: 'Sort field',
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    description: 'Sort order (asc or desc)',
  })
  findAll(
    @Query('search') search?: string,
    @Query('isPublic') isPublic?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    const query: any = {};
    if (search) query.search = search;
    if (isPublic !== undefined) query.isPublic = isPublic === 'true';
    if (page) query.page = parseInt(page);
    if (limit) query.limit = parseInt(limit);
    if (sortBy) query.sortBy = sortBy;
    if (sortOrder) query.sortOrder = sortOrder;

    return this.newsService.findAll(query);
  }

  @Get('featured')
  @ApiOperation({ summary: 'Get featured news articles' })
  @ApiResponse({ status: 200, description: 'Return featured news articles.' })
  findFeatured() {
    return this.newsService.findFeatured();
  }

  @Get('latest')
  @ApiOperation({ summary: 'Get latest news articles' })
  @ApiResponse({ status: 200, description: 'Return latest news articles.' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of latest articles to return',
    type: Number,
  })
  @ApiQuery({
    name: 'isPublic',
    required: false,
    description: 'Filter by public status',
    type: Boolean,
  })
  findLatest(@Query('limit') limit?: number, @Query('isPublic') isPublic?: boolean) {
    const limitValue = limit ? parseInt(limit.toString()) : 5;
    return this.newsService.findLatest(limitValue);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a news article by id' })
  @ApiResponse({ status: 200, description: 'Return the news article.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  findOne(@Param('id') id: string) {
    return this.newsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a news article' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 200,
    description: 'The news article has been successfully updated.',
  })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  update(
    @Param('id') id: string,
    @Body() updateNewsDto: UpdateNewsDto,
    @Req() req: any,
  ) {
    // The files are attached to the request by the FileUploadMiddleware
    const files = req.files;
    return this.newsService.update(id, updateNewsDto, files);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a news article' })
  @ApiResponse({
    status: 200,
    description: 'The news article has been successfully deleted.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  remove(@Param('id') id: string) {
    return this.newsService.remove(id);
  }

  @Patch(':id/toggle-featured')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle featured status of a news article' })
  @ApiResponse({
    status: 200,
    description: 'The featured status has been successfully toggled.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  toggleFeatured(@Param('id') id: string) {
    return this.newsService.toggleFeatured(id);
  }

  @Patch(':id/toggle-public')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle public status of a news article' })
  @ApiResponse({
    status: 200,
    description: 'The public status has been successfully toggled.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  togglePublic(@Param('id') id: string) {
    return this.newsService.togglePublic(id);
  }
}
