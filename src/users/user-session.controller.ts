import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { UserSessionService } from './user-session.service';
import { CreateUserSessionDto } from './dto/create-user-session.dto';
import { UpdateUserSessionDto } from './dto/update-user-session.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UserSession } from './entities/user-session.entity';

@ApiTags('user-sessions')
@Controller('user-sessions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserSessionController {
  constructor(private readonly userSessionService: UserSessionService) {}

  @Post()
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Create a new user session (Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'User session created successfully.',
    type: UserSession,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required.',
  })
  create(@Body() createUserSessionDto: CreateUserSessionDto) {
    return this.userSessionService.create(createUserSessionDto);
  }

  @Get('my-sessions')
  @ApiOperation({ summary: "Get current user's active sessions" })
  @ApiResponse({
    status: 200,
    description: 'List of user sessions.',
    type: [UserSession],
  })
  findMyActiveSessions(@Request() req) {
    return this.userSessionService.findAllByUser(req.user.id);
  }

  @Get('current')
  @ApiOperation({ summary: 'Get current session information' })
  @ApiResponse({
    status: 200,
    description: 'Current session details.',
    type: UserSession,
  })
  async getCurrentSession(@Request() req) {
    // Extract token from authorization header
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      throw new ForbiddenException('No token provided');
    }

    const session = await this.userSessionService.findByToken(token);
    if (!session) {
      throw new ForbiddenException('Session not found');
    }

    return session;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific user session by ID' })
  @ApiResponse({
    status: 200,
    description: 'User session details.',
    type: UserSession,
  })
  @ApiResponse({ status: 404, description: 'User session not found.' })
  async findOne(@Param('id') id: string, @Request() req) {
    const session = await this.userSessionService.findOne(id);

    // Users can only view their own sessions, admins can view any
    if (session.userId !== req.user.id && !req.user.isAdmin) {
      throw new ForbiddenException('You can only view your own sessions');
    }

    return session;
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Update a user session (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'User session updated successfully.',
    type: UserSession,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required.',
  })
  @ApiResponse({ status: 404, description: 'User session not found.' })
  update(
    @Param('id') id: string,
    @Body() updateUserSessionDto: UpdateUserSessionDto,
  ) {
    return this.userSessionService.update(id, updateUserSessionDto);
  }

  @Patch(':id/activity')
  @ApiOperation({ summary: 'Update session last activity timestamp' })
  @ApiResponse({
    status: 200,
    description: 'Session activity updated.',
    type: UserSession,
  })
  @ApiResponse({ status: 404, description: 'User session not found.' })
  async updateActivity(@Param('id') id: string, @Request() req) {
    const session = await this.userSessionService.findOne(id);

    // Users can only update their own session activity
    if (session.userId !== req.user.id) {
      throw new ForbiddenException(
        'You can only update your own session activity',
      );
    }

    return this.userSessionService.updateActivity(id);
  }

  @Post(':id/revoke')
  @ApiOperation({ summary: 'Revoke a specific session' })
  @ApiResponse({ status: 200, description: 'Session revoked successfully.' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Can only revoke own sessions.',
  })
  @ApiResponse({ status: 404, description: 'User session not found.' })
  async revokeSession(@Param('id') id: string, @Request() req) {
    await this.userSessionService.revokeSession(id, req.user.id);
    return { message: 'Session revoked successfully' };
  }

  @Post('revoke-all')
  @ApiOperation({ summary: 'Revoke all user sessions except current one' })
  @ApiResponse({
    status: 200,
    description: 'All sessions revoked successfully.',
  })
  async revokeAllSessions(@Request() req) {
    // Get current session to exclude it
    const token = req.headers.authorization?.replace('Bearer ', '');
    let currentSessionId: string | undefined;

    if (token) {
      const currentSession = await this.userSessionService.findByToken(token);
      currentSessionId = currentSession?.id;
    }

    await this.userSessionService.revokeAllUserSessions(
      req.user.id,
      currentSessionId,
    );
    return { message: 'All other sessions revoked successfully' };
  }

  @Get('user/:userId')
  @UseGuards(AdminGuard)
  @ApiOperation({
    summary: 'Get all sessions for a specific user (Admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of user sessions.',
    type: [UserSession],
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required.',
  })
  findUserSessions(@Param('userId') userId: string) {
    return this.userSessionService.findAllByUser(userId);
  }

  @Post('cleanup-expired')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Cleanup expired sessions (Admin only)' })
  @ApiResponse({ status: 200, description: 'Expired sessions cleaned up.' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required.',
  })
  async cleanupExpiredSessions() {
    await this.userSessionService.cleanupExpiredSessions();
    return { message: 'Expired sessions cleaned up successfully' };
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Delete a user session (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'User session deleted successfully.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required.',
  })
  @ApiResponse({ status: 404, description: 'User session not found.' })
  async remove(@Param('id') id: string) {
    await this.userSessionService.remove(id);
    return { message: 'User session deleted successfully' };
  }
}
