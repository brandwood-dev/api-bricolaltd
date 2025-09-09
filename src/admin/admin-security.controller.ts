import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { EnhancedAdminGuard } from '../auth/guards/enhanced-admin.guard';
import { AdminPermissions } from '../auth/decorators/admin-permissions.decorator';
import { AdminSecurityService, SecurityLogFilters } from './admin-security.service';
import { SecurityEventType, SecuritySeverity } from './entities/security-log.entity';

@ApiTags('admin-security')
@Controller('admin/security')
@UseGuards(EnhancedAdminGuard)
@ApiBearerAuth()
export class AdminSecurityController {
  constructor(private readonly adminSecurityService: AdminSecurityService) {}

  @Get('sessions')
  @AdminPermissions('view_sessions')
  @ApiOperation({ summary: 'Get active user sessions' })
  @ApiResponse({ status: 200, description: 'Active sessions' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getActiveSessions(
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    return this.adminSecurityService.getActiveSessions(page, limit);
  }

  @Delete('sessions/:sessionId')
  @AdminPermissions('manage_sessions')
  @ApiOperation({ summary: 'Terminate user session' })
  @ApiResponse({ status: 200, description: 'Session terminated successfully' })
  async terminateSession(@Param('sessionId') sessionId: string) {
    return this.adminSecurityService.terminateSession(sessionId);
  }

  @Delete('users/:userId/sessions')
  @AdminPermissions('manage_sessions')
  @ApiOperation({ summary: 'Terminate all sessions for a user' })
  @ApiResponse({ status: 200, description: 'All user sessions terminated' })
  async terminateUserSessions(@Param('userId') userId: string) {
    return this.adminSecurityService.terminateUserSessions(userId);
  }

  @Get('logs')
  @AdminPermissions('view_security_logs')
  @ApiOperation({ summary: 'Get security logs' })
  @ApiResponse({ status: 200, description: 'Security logs' })
  @ApiQuery({ name: 'eventType', required: false, enum: SecurityEventType })
  @ApiQuery({ name: 'severity', required: false, enum: SecuritySeverity })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'ipAddress', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async getSecurityLogs(
    @Query('eventType') eventType?: SecurityEventType,
    @Query('severity') severity?: SecuritySeverity,
    @Query('userId') userId?: string,
    @Query('ipAddress') ipAddress?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const filters: SecurityLogFilters = {
      eventType,
      severity,
      userId,
      ipAddress,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    };
    return this.adminSecurityService.getSecurityLogs(filters, page, limit);
  }

  @Get('admin-activities')
  @AdminPermissions('view_admin_activities')
  @ApiOperation({ summary: 'Get admin activity logs' })
  @ApiResponse({ status: 200, description: 'Admin activity logs' })
  @ApiQuery({ name: 'adminId', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getAdminActivities(
    @Query('adminId') adminId?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
  ) {
    return this.adminSecurityService.getAdminActivities(adminId, page, limit);
  }

  @Get('failed-logins')
  @AdminPermissions('view_security_logs')
  @ApiOperation({ summary: 'Get failed login attempts' })
  @ApiResponse({ status: 200, description: 'Failed login attempts' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getFailedLogins(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
  ) {
    return this.adminSecurityService.getFailedLogins(page, limit);
  }

  @Post('block-ip')
  @AdminPermissions('manage_security')
  @ApiOperation({ summary: 'Block IP address' })
  @ApiResponse({ status: 200, description: 'IP address blocked successfully' })
  async blockIpAddress(@Body() body: { ipAddress: string; reason: string }) {
    return this.adminSecurityService.blockIpAddress(body.ipAddress, body.reason);
  }

  @Delete('block-ip/:ipAddress')
  @AdminPermissions('manage_security')
  @ApiOperation({ summary: 'Unblock IP address' })
  @ApiResponse({ status: 200, description: 'IP address unblocked successfully' })
  async unblockIpAddress(@Param('ipAddress') ipAddress: string) {
    return this.adminSecurityService.unblockIpAddress(ipAddress);
  }

  @Get('blocked-ips')
  @AdminPermissions('view_security_logs')
  @ApiOperation({ summary: 'Get blocked IP addresses' })
  @ApiResponse({ status: 200, description: 'Blocked IP addresses' })
  async getBlockedIps() {
    return this.adminSecurityService.getBlockedIps();
  }

  @Get('security-overview')
  @AdminPermissions('view_dashboard')
  @ApiOperation({ summary: 'Get security overview dashboard' })
  @ApiResponse({ status: 200, description: 'Security overview data' })
  async getSecurityOverview() {
    return this.adminSecurityService.getSecurityOverview();
  }
}