import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { EnhancedAdminGuard } from '../auth/guards/enhanced-admin.guard';
import { AdminPermissions } from '../auth/decorators/admin-permissions.decorator';
import { AdminToolsService } from './admin-tools.service';
import { UpdateToolStatusDto } from './dto/update-tool-status.dto';

@ApiTags('admin-tools')
@Controller('admin/tools')
@UseGuards(EnhancedAdminGuard)
@ApiBearerAuth()
export class AdminToolsController {
  constructor(private readonly adminToolsService: AdminToolsService) {}

  @Get()
  @AdminPermissions('manage_tools')
  @ApiOperation({ summary: 'Get all tools with admin filters and pagination' })
  @ApiResponse({ status: 200, description: 'Return paginated tools with filters.' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 10)' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search term for tool title' })
  @ApiQuery({ name: 'status', required: false, enum: ['DRAFT', 'PUBLISHED', 'UNDER_REVIEW', 'REJECTED', 'ARCHIVED'], description: 'Filter by tool status' })
  @ApiQuery({ name: 'categoryId', required: false, type: String, description: 'Filter by category ID' })
  @ApiQuery({ name: 'subcategoryId', required: false, type: String, description: 'Filter by subcategory ID' })
  @ApiQuery({ name: 'ownerId', required: false, type: String, description: 'Filter by owner ID' })
  @ApiQuery({ name: 'dateFrom', required: false, type: String, description: 'Filter by creation date from (YYYY-MM-DD)' })
  @ApiQuery({ name: 'dateTo', required: false, type: String, description: 'Filter by creation date to (YYYY-MM-DD)' })
  async findAllForAdmin(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('categoryId') categoryId?: string,
    @Query('subcategoryId') subcategoryId?: string,
    @Query('ownerId') ownerId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const filters = {
      search,
      status,
      categoryId,
      subcategoryId,
      ownerId,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
    };
    const pagination = { page, limit };
    return this.adminToolsService.findAllForAdmin(filters, pagination);
  }

  @Get('stats')
  @AdminPermissions('view_dashboard')
  @ApiOperation({ summary: 'Get tool statistics for admin dashboard' })
  @ApiResponse({ status: 200, description: 'Return tool statistics.' })
  async getToolStats() {
    return this.adminToolsService.getToolStats();
  }

  @Get(':id')
  @AdminPermissions('manage_tools')
  @ApiOperation({ summary: 'Get a tool by ID for admin' })
  @ApiResponse({ status: 200, description: 'Return the tool with full details.' })
  @ApiResponse({ status: 404, description: 'Tool not found.' })
  @ApiParam({ name: 'id', description: 'Tool ID' })
  async findOneForAdmin(@Param('id') id: string) {
    return this.adminToolsService.findOneForAdmin(id);
  }

  @Patch(':id/approve')
  @AdminPermissions('manage_tools')
  @ApiOperation({ summary: 'Approve a tool' })
  @ApiResponse({ status: 200, description: 'Tool approved successfully.' })
  @ApiResponse({ status: 404, description: 'Tool not found.' })
  @ApiParam({ name: 'id', description: 'Tool ID' })
  async approveTool(@Param('id') id: string) {
    return this.adminToolsService.approveTool(id);
  }

  @Patch(':id/reject')
  @AdminPermissions('manage_tools')
  @ApiOperation({ summary: 'Reject a tool' })
  @ApiResponse({ status: 200, description: 'Tool rejected successfully.' })
  @ApiResponse({ status: 400, description: 'Rejection reason is required.' })
  @ApiResponse({ status: 404, description: 'Tool not found.' })
  @ApiParam({ name: 'id', description: 'Tool ID' })
  async rejectTool(
    @Param('id') id: string,
    @Body() updateToolStatusDto: UpdateToolStatusDto,
  ) {
    if (!updateToolStatusDto.reason || updateToolStatusDto.reason.trim() === '') {
      throw new BadRequestException('Rejection reason is required');
    }
    return this.adminToolsService.rejectTool(id, updateToolStatusDto.reason);
  }

  // Test endpoint to validate rejection notifications and emails
  @Post('test/rejection-templates')
  @AdminPermissions('manage_tools')
  @ApiOperation({ summary: 'Run rejection templates test for 6 reasons' })
  @ApiResponse({ status: 200, description: 'Test executed successfully.' })
  async runRejectionTemplatesTest(@Body() body: { ownerEmail: string; ownerId?: string }) {
    return this.adminToolsService.runRejectionTemplatesTest(body.ownerEmail, body.ownerId);
  }

  @Patch(':id/status')
  @AdminPermissions('manage_tools')
  @ApiOperation({ summary: 'Update tool status' })
  @ApiResponse({ status: 200, description: 'Tool status updated successfully.' })
  @ApiResponse({ status: 404, description: 'Tool not found.' })
  @ApiParam({ name: 'id', description: 'Tool ID' })
  async updateToolStatus(
    @Param('id') id: string,
    @Body() updateToolStatusDto: UpdateToolStatusDto,
  ) {
    return this.adminToolsService.updateToolStatus(id, updateToolStatusDto);
  }

  @Delete(':id')
  @AdminPermissions('manage_tools')
  @ApiOperation({ summary: 'Delete a tool (admin only)' })
  @ApiResponse({ status: 200, description: 'Tool deleted successfully.' })
  @ApiResponse({ status: 404, description: 'Tool not found.' })
  @ApiParam({ name: 'id', description: 'Tool ID' })
  async deleteTool(@Param('id') id: string) {
    return this.adminToolsService.deleteTool(id);
  }

  @Patch(':id/archive')
  @AdminPermissions('manage_tools')
  @ApiOperation({ summary: 'Archive a tool' })
  @ApiResponse({ status: 200, description: 'Tool archived successfully.' })
  @ApiResponse({ status: 404, description: 'Tool not found.' })
  @ApiParam({ name: 'id', description: 'Tool ID' })
  async archiveTool(@Param('id') id: string) {
    return this.adminToolsService.archiveTool(id);
  }

  @Patch(':id/restore')
  @AdminPermissions('manage_tools')
  @ApiOperation({ summary: 'Restore an archived tool' })
  @ApiResponse({ status: 200, description: 'Tool restored successfully.' })
  @ApiResponse({ status: 404, description: 'Tool not found.' })
  @ApiParam({ name: 'id', description: 'Tool ID' })
  async restoreTool(@Param('id') id: string) {
    return this.adminToolsService.restoreTool(id);
  }
}