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
import { ToolsService } from './tools.service';
import { CreateToolDto } from './dto/create-tool.dto';
import { UpdateToolDto } from './dto/update-tool.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModerationStatus } from './enums/moderation-status.enum';
import { ToolStatus } from './enums/tool-status.enum';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
} from '@nestjs/swagger';

@ApiTags('tools')
@Controller('tools')
export class ToolsController {
  constructor(private readonly toolsService: ToolsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new tool' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 201,
    description: 'The tool has been successfully created.',
  })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  create(@Body() createToolDto: CreateToolDto, @Req() req: any) {
    // The files are attached to the request by the FileUploadMiddleware
    const files = req.files;
    return this.toolsService.create(createToolDto, files);
  }

  @Get()
  @ApiOperation({ summary: 'Get all tools' })
  @ApiResponse({ status: 200, description: 'Return all tools.' })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search term for tool name',
  })
  @ApiQuery({
    name: 'toolStatus',
    required: false,
    description: 'Filter by tool status',
    type: String,
  })
  @ApiQuery({
    name: 'moderationStatus',
    required: false,
    description: 'Filter by moderation status',
    type: String,
  })
  findAll(
    @Query('search') search?: string,

    @Query('toolStatus') toolStatus?: string,
    @Query('moderationStatus') moderationStatus?: string,
  ) {
    const query: any = {};
    if (search) query.search = search;

    if (toolStatus) query.toolStatus = toolStatus;
    if (moderationStatus) query.moderationStatus = moderationStatus;

    return this.toolsService.findAll(query);
  }

  @Get('featured')
  @ApiOperation({ summary: 'Get featured tools' })
  @ApiResponse({ status: 200, description: 'Return featured tools.' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of tools to return (default: 8)',
    type: Number,
  })
  findFeatured(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 8;
    return this.toolsService.getFeaturedTools(parsedLimit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a tool by id' })
  @ApiResponse({ status: 200, description: 'Return the tool.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  async findOne(@Param('id') id: string) {
    const tool = await this.toolsService.findOne(id);
    return {
      data: tool,
      message: 'Request successful',
    };
  }

  @Get('user/:userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get tools by user id' })
  @ApiResponse({ status: 200, description: 'Return the tools.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  findByUser(@Param('userId') userId: string) {
    return this.toolsService.findByUser(userId);
  }

  @Get(':id/check-availability')
  @ApiOperation({ summary: 'Check tool availability for specific dates' })
  @ApiResponse({ status: 200, description: 'Return availability status.' })
  @ApiResponse({ status: 404, description: 'Tool not found.' })
  @ApiQuery({
    name: 'startDate',
    required: true,
    description: 'Start date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'endDate',
    required: true,
    description: 'End date (YYYY-MM-DD)',
  })
  checkAvailability(
    @Param('id') id: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.toolsService.checkAvailabilityForDates(
      id,
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a tool' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 200,
    description: 'The tool has been successfully updated.',
  })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  update(
    @Param('id') id: string,
    @Body() updateToolDto: UpdateToolDto,
    @Req() req: any,
  ) {
    console.table(updateToolDto);
  
    // The files are attached to the request by the FileUploadMiddleware
    const files = req.files;
    return this.toolsService.update(id, updateToolDto, files);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a tool' })
  @ApiResponse({
    status: 200,
    description: 'The tool has been successfully deleted.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  remove(@Param('id') id: string) {
    return this.toolsService.remove(id);
  }

  @Patch(':id/availability')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update tool availability' })
  @ApiResponse({
    status: 200,
    description: 'The tool availability has been successfully updated.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  updateAvailability(
    @Param('id') id: string,
    @Body('isAvailable') isAvailable: boolean,
  ) {
    return this.toolsService.updateAvailability(id, isAvailable);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update tool status (DRAFT/PUBLISHED)' })
  @ApiResponse({
    status: 200,
    description: 'The tool status has been successfully updated.',
  })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  updateToolStatus(
    @Param('id') id: string,
    @Body('status') status: ToolStatus,
  ) {
    return this.toolsService.updateToolStatus(id, status);
  }

  @Get(':id/photos')
  @ApiOperation({ summary: 'Get all photos for a tool' })
  @ApiResponse({ status: 200, description: 'Return all photos for the tool.' })
  @ApiResponse({ status: 404, description: 'Tool not found.' })
  async getToolPhotos(@Param('id') id: string) {
    const tool = await this.toolsService.findOne(id);
    return (tool as any).photos || [];
  }

  @Get('check-name/:name')
  @ApiOperation({ summary: 'Check if tool name is unique' })
  @ApiResponse({
    status: 200,
    description: 'Return whether the name is available.',
  })
  async checkNameUniqueness(@Param('name') name: string) {
    return this.toolsService.checkNameUniqueness(name);
  }

  @Patch(':id/moderation-status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update tool moderation status (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'The tool moderation status has been successfully updated.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  updateModerationStatus(
    @Param('id') id: string,
    @Body('status') status: ModerationStatus,
  ) {
    return this.toolsService.updateModerationStatus(id, status);
  }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all tools for admin (including unconfirmed)' })
  @ApiResponse({ status: 200, description: 'Return all tools for admin.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search term for tool name',
  })
  @ApiQuery({
    name: 'moderationStatus',
    required: false,
    description: 'Filter by moderation status',
    enum: ModerationStatus,
  })
  findAllForAdmin(
    @Query('search') search?: string,
    @Query('moderationStatus') moderationStatus?: ModerationStatus,
  ) {
    const query: any = {};
    if (search) query.search = search;
    if (moderationStatus) query.moderationStatus = moderationStatus;

    return this.toolsService.findAllForAdmin(query);
  }
}
