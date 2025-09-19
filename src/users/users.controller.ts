import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { User } from './entities/user.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EnhancedAdminGuard } from '../auth/guards/enhanced-admin.guard';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({
    status: 201,
    description: 'The user has been successfully created.',
    type: User,
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 409, description: 'Email already exists.' })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  // User endpoints - must come before admin endpoints
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Return current user profile.', type: User })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getMyProfile(@Request() req) {
    return this.usersService.findOne(req.user.id);
  }

  @Get('me/transactions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user transactions' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'type', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Return current user transactions.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getMyTransactions(
    @Request() req,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('type') type?: string,
    @Query('status') status?: string,
  ) {
    return this.usersService.getUserTransactions(req.user.id, page, limit, { type, status });
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({
    status: 200,
    description: 'The user profile has been successfully updated.',
    type: User,
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 409, description: 'Email already exists.' })
  async updateMyProfile(@Request() req, @Body() updateProfileDto: UpdateProfileDto) {
    return this.usersService.updateProfile(req.user.id, updateProfileDto);
  }

  @Post('profile/upload-photo')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('photo'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload profile photo to S3' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        photo: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Profile photo uploaded successfully.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            url: { type: 'string' },
          },
        },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  async uploadProfilePhoto(
    @Request() req: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.usersService.uploadProfilePhoto(req.user.id, file);
  }

  @Get()
  @UseGuards(JwtAuthGuard, EnhancedAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all users with admin filters and pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'isVerified', required: false, type: Boolean })
  @ApiQuery({ name: 'isAdmin', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Return paginated users with filters.' })
  async findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('search') search?: string,
    @Query('isActive') isActive?: boolean,
    @Query('isVerified') isVerified?: boolean,
    @Query('isAdmin') isAdmin?: boolean,
  ) {
    const filters = {
      search,
      verified: isVerified,
      isAdmin,
      status: isActive === true ? 'active' as const : isActive === false ? 'inactive' as const : undefined,
    };
    const pagination = { page, limit };
    return this.usersService.findAllForAdmin(filters, pagination);
  }

  // Admin endpoints - specific routes must come before parameterized routes
  @Get('stats')
  @UseGuards(JwtAuthGuard, EnhancedAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user statistics for admin dashboard' })
  @ApiResponse({ status: 200, description: 'Return user statistics.' })
  async getUserStats() {
    return this.usersService.getUserStats();
  }

  @Get('export')
  @UseGuards(JwtAuthGuard, EnhancedAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Export users data to CSV' })
  @ApiResponse({ status: 200, description: 'Return CSV file with users data.' })
  async exportUsers() {
    return this.usersService.exportUsers({});
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, EnhancedAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get detailed user information for admin' })
  @ApiResponse({ status: 200, description: 'Return detailed user information.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async findOne(@Param('id') id: string) {
    return this.usersService.findOneForAdmin(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, EnhancedAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a user (admin)' })
  @ApiResponse({
    status: 200,
    description: 'The user has been successfully updated.',
    type: User,
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  @ApiResponse({ status: 409, description: 'Email already exists.' })
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Post(':id/upload-profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('profilePicture'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload user profile picture' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        profilePicture: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Profile picture uploaded successfully.',
    type: User,
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  @ApiResponse({ status: 403, description: 'Forbidden - Can only update own profile.' })
  async uploadProfilePicture(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    return this.usersService.uploadProfilePicture(id, file, req.user);
  }

  @Delete('account')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete my account' })
  @ApiResponse({ status: 200, description: 'Account deleted successfully.' })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid password or account cannot be deleted.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async deleteMyAccount(
    @Request() req: any,
  ) {
    return this.usersService.deleteUserAccount(req.user.id);
  }

  // @Delete(':id')
  // @UseGuards(JwtAuthGuard, EnhancedAdminGuard)
  // @ApiBearerAuth()
  // @ApiOperation({ summary: 'Delete a user (admin)' })
  // @ApiResponse({
  //   status: 200,
  //   description: 'The user has been successfully deleted.',
  // })
  // @ApiResponse({ status: 404, description: 'User not found.' })
  // remove(@Param('id') id: string) {
  //   return this.usersService.remove(id);
  // }

  // Additional admin endpoints



  @Patch(':id/activate')
  @UseGuards(JwtAuthGuard, EnhancedAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Activate a user account' })
  @ApiResponse({ status: 200, description: 'User activated successfully.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async activateUser(@Param('id') id: string) {
    return this.usersService.activateUser(id);
  }

  @Patch(':id/deactivate')
  @UseGuards(JwtAuthGuard, EnhancedAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Deactivate a user account' })
  @ApiResponse({ status: 200, description: 'User deactivated successfully.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async deactivateUser(@Param('id') id: string) {
    return this.usersService.deactivateUser(id);
  }

  @Patch(':id/verify-email')
  @UseGuards(JwtAuthGuard, EnhancedAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Manually verify user email' })
  @ApiResponse({ status: 200, description: 'User email verified successfully.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async verifyUserEmail(@Param('id') id: string) {
    return this.usersService.verifyUserEmail(id);
  }

  @Patch(':id/verify-identity')
  @UseGuards(JwtAuthGuard, EnhancedAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Manually verify user identity' })
  @ApiResponse({ status: 200, description: 'User identity verified successfully.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async verifyUserIdentity(@Param('id') id: string) {
    return this.usersService.verifyUserIdentity(id);
  }

  @Post(':id/reset-password')
  @UseGuards(JwtAuthGuard, EnhancedAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Force password reset for user' })
  @ApiResponse({ status: 200, description: 'Password reset email sent successfully.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async forcePasswordReset(@Param('id') id: string) {
    return this.usersService.forcePasswordReset(id);
  }

  @Get(':id/sessions')
  @UseGuards(JwtAuthGuard, EnhancedAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user active sessions' })
  @ApiResponse({ status: 200, description: 'Return user sessions.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async getUserSessions(@Param('id') id: string) {
    return this.usersService.getUserSessions(id);
  }

  @Delete(':id/sessions')
  @UseGuards(JwtAuthGuard, EnhancedAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Terminate all user sessions' })
  @ApiResponse({ status: 200, description: 'All user sessions terminated.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async terminateUserSessions(@Param('id') id: string) {
    return this.usersService.terminateUserSessions(id);
  }

  @Get(':id/activities')
  @UseGuards(JwtAuthGuard, EnhancedAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user activity log' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Return user activities.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async getUserActivities(
    @Param('id') id: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.usersService.getUserActivities(id, limit);
  }

  @Get(':id/transactions')
  @UseGuards(JwtAuthGuard, EnhancedAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user transactions' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Return user transactions.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async getUserTransactions(
    @Param('id') id: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.usersService.getUserTransactions(id, page, limit);
  }

  @Get(':id/deletion-validation')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Validate if user account can be deleted' })
  @ApiResponse({ status: 200, description: 'Return validation results for account deletion.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  @ApiResponse({ status: 403, description: 'Forbidden - Can only validate own account.' })
  async validateAccountDeletion(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.usersService.validateAccountDeletion(id, req.user);
  }

  @Post('bulk-action')
  @UseGuards(JwtAuthGuard, EnhancedAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Perform bulk actions on users' })
  @ApiResponse({ status: 200, description: 'Bulk action completed successfully.' })
  async bulkAction(
    @Body() bulkActionDto: { userIds: string[]; action: 'activate' | 'deactivate' | 'verify' | 'delete' },
  ) {
    return this.usersService.bulkAction(bulkActionDto.userIds, bulkActionDto.action);
  }

}
