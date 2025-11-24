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
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { AccountDeletionRequestService } from './account-deletion-request.service';
import { CreateAccountDeletionRequestDto } from './dto/create-account-deletion-request.dto';
import { UpdateAccountDeletionRequestDto } from './dto/update-account-deletion-request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { DeletionStatus } from './enums/deletion-status.enum';

@ApiTags('Account Deletion Requests')
@Controller('account-deletion-requests')
export class AccountDeletionRequestController {
  constructor(
    private readonly accountDeletionRequestService: AccountDeletionRequestService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create account deletion request' })
  @ApiResponse({
    status: 201,
    description: 'Account deletion request created successfully.',
  })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  create(
    @Body() createAccountDeletionRequestDto: CreateAccountDeletionRequestDto,
    @Request() req: any,
  ) {
    return this.accountDeletionRequestService.create(
      req.user.id,
      createAccountDeletionRequestDto,
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all account deletion requests (Admin only)' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: DeletionStatus,
    description: 'Filter by status',
  })
  @ApiResponse({
    status: 200,
    description: 'List of account deletion requests.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  findAll(@Query('status') status?: DeletionStatus) {
    if (status) {
      return this.accountDeletionRequestService.findByStatus(status);
    }
    return this.accountDeletionRequestService.findAll();
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my account deletion requests' })
  @ApiResponse({
    status: 200,
    description: 'List of user account deletion requests.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  findMine(@Request() req: any) {
    return this.accountDeletionRequestService.findByUser(req.user.id);
  }

  @Get('pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get pending deletion requests (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'List of pending account deletion requests.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  findPending() {
    return this.accountDeletionRequestService.getPendingRequests();
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get deletion request statistics (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Account deletion request statistics.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  getStats() {
    return this.accountDeletionRequestService.getRequestStats();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get account deletion request by ID' })
  @ApiParam({ name: 'id', description: 'Account deletion request ID' })
  @ApiResponse({
    status: 200,
    description: 'Account deletion request details.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  findOne(@Param('id') id: string) {
    return this.accountDeletionRequestService.findOne(id);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update deletion request status (Admin only)' })
  @ApiParam({ name: 'id', description: 'Account deletion request ID' })
  @ApiResponse({
    status: 200,
    description: 'Account deletion request status updated successfully.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  updateStatus(
    @Param('id') id: string,
    @Body() updateAccountDeletionRequestDto: UpdateAccountDeletionRequestDto,
    @Request() req: any,
  ) {
    return this.accountDeletionRequestService.updateStatus(
      id,
      updateAccountDeletionRequestDto,
      req.user.id,
    );
  }

  @Delete(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel my deletion request' })
  @ApiParam({ name: 'id', description: 'Account deletion request ID' })
  @ApiResponse({ status: 204, description: 'Request cancelled successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  cancel(@Param('id') id: string, @Request() req: any) {
    return this.accountDeletionRequestService.cancel(id, req.user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete account deletion request ' })
  @ApiParam({ name: 'id', description: 'Account deletion request ID' })
  @ApiResponse({ status: 204, description: 'Request deleted successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  remove(@Param('id') id: string) {
    return this.accountDeletionRequestService.remove(id);
  }
}
