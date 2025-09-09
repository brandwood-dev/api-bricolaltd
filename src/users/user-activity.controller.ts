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
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { UserActivityService } from './user-activity.service';
import { CreateUserActivityDto } from './dto/create-user-activity.dto';
import { UpdateUserActivityDto } from './dto/update-user-activity.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UserActivity } from './entities/user-activity.entity';
import { ActivityType } from './enums/activity-type.enum';

@ApiTags('user-activities')
@Controller('user-activities')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserActivityController {
  constructor(private readonly userActivityService: UserActivityService) {}

  @Post()
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Create a new user activity (Admin only)' })
  @ApiResponse({ status: 201, description: 'User activity created successfully.', type: UserActivity })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required.' })
  create(@Body() createUserActivityDto: CreateUserActivityDto) {
    return this.userActivityService.create(createUserActivityDto);
  }

  @Get()
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Get all user activities (Admin only)' })
  @ApiResponse({ status: 200, description: 'List of user activities.', type: [UserActivity] })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required.' })
  @ApiQuery({ name: 'activityType', required: false, enum: ActivityType })
  findAll(@Query('activityType') activityType?: ActivityType) {
    if (activityType) {
      return this.userActivityService.findByActivityType(activityType);
    }
    return this.userActivityService.findAll();
  }

  @Get('my-activities')
  @ApiOperation({ summary: 'Get current user\'s activities' })
  @ApiResponse({ status: 200, description: 'List of user activities.', type: [UserActivity] })
  findMyActivities(@Request() req) {
    return this.userActivityService.findByUserId(req.user.id);
  }

  @Get('stats')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Get activity statistics (Admin only)' })
  @ApiResponse({ status: 200, description: 'Activity statistics.' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required.' })
  @ApiQuery({ name: 'userId', required: false })
  getStats(@Query('userId') userId?: string) {
    return this.userActivityService.getActivityStats(userId);
  }

  @Get('recent')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Get recent activities (Admin only)' })
  @ApiResponse({ status: 200, description: 'List of recent activities.', type: [UserActivity] })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required.' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'userId', required: false })
  getRecentActivities(
    @Query('limit') limit?: number,
    @Query('userId') userId?: string
  ) {
    return this.userActivityService.getRecentActivities(limit, userId);
  }

  @Get(':id')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Get a user activity by ID (Admin only)' })
  @ApiResponse({ status: 200, description: 'User activity details.', type: UserActivity })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required.' })
  @ApiResponse({ status: 404, description: 'User activity not found.' })
  findOne(@Param('id') id: string) {
    return this.userActivityService.findOne(id);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get activities for a specific user' })
  @ApiResponse({ status: 200, description: 'List of user activities.', type: [UserActivity] })
  @ApiResponse({ status: 403, description: 'Forbidden - Can only view own activities.' })
  async findByUserId(@Param('userId') userId: string, @Request() req) {
    // Users can only view their own activities, admins can view any
    if (userId !== req.user.id && !req.user.isAdmin) {
      throw new ForbiddenException('You can only view your own activities');
    }
    
    return this.userActivityService.findByUserId(userId);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Update a user activity (Admin only)' })
  @ApiResponse({ status: 200, description: 'User activity updated successfully.', type: UserActivity })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required.' })
  @ApiResponse({ status: 404, description: 'User activity not found.' })
  update(@Param('id') id: string, @Body() updateUserActivityDto: UpdateUserActivityDto) {
    return this.userActivityService.update(id, updateUserActivityDto);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Delete a user activity (Admin only)' })
  @ApiResponse({ status: 200, description: 'User activity deleted successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required.' })
  @ApiResponse({ status: 404, description: 'User activity not found.' })
  remove(@Param('id') id: string) {
    return this.userActivityService.remove(id);
  }
}