/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Request,
  UnauthorizedException,
  Put,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { UsersService } from '../users/users.service';
import { IsEmail, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateAdminProfileDto {
  @ApiProperty({
    description: 'The email of the admin',
    example: 'admin@example.com',
    required: false,
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsOptional()
  email?: string;

  @ApiProperty({
    description: 'The first name of the admin',
    example: 'John',
    required: false,
  })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiProperty({
    description: 'The last name of the admin',
    example: 'Doe',
    required: false,
  })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiProperty({
    description: 'The phone number of the admin',
    example: '+1234567890',
    required: false,
  })
  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @ApiProperty({
    description: 'The address of the admin',
    example: '123 Main Street',
    required: false,
  })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({
    description: 'The city of the admin',
    example: 'Paris',
    required: false,
  })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiProperty({
    description: 'The postal code of the admin',
    example: '75001',
    required: false,
  })
  @IsString()
  @IsOptional()
  postalCode?: string;

  @ApiProperty({
    description: 'The country ID of the admin (ISO Alpha-2 code)',
    example: 'FR',
    required: false,
  })
  @IsString()
  @IsOptional()
  countryId?: string;

  @ApiProperty({
    description: 'The profile picture URL of the admin',
    required: false,
  })
  @IsString()
  @IsOptional()
  profilePicture?: string;
}

@ApiTags('admin')
@Controller('admin')
export class AdminAuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Post('login')
  @ApiOperation({ summary: 'Admin login with email and password' })
  @ApiResponse({ status: 200, description: 'Admin successfully logged in.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required.',
  })
  async login(@Body() loginDto: LoginDto) {
    const result = await this.authService.loginWithCredentials(loginDto);

    // Validate admin access using isAdmin field
    if (!result.user.isAdmin) {
      throw new UnauthorizedException('Admin access required');
    }

    return result;
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin logout' })
  @ApiResponse({ status: 200, description: 'Admin successfully logged out.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async logout() {
    // For now, just return success - token invalidation can be handled client-side
    return { message: 'Successfully logged out' };
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get admin profile' })
  @ApiResponse({ status: 200, description: 'Return the admin profile.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required.',
  })
  getProfile(@Request() req) {
    return req.user;
  }

  @Post('refresh')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Refresh admin token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 400, description: 'Invalid refresh token.' })
  async refreshToken(@Body() body: { refreshToken: string }) {
    if (!body.refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }
    
    try {
      const result = await this.authService.refreshToken(body.refreshToken);
      
      // Verify the user is an admin
      if (!result.user.isAdmin) {
        throw new UnauthorizedException('Admin access required');
      }
      
      return result;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change admin password' })
  @ApiResponse({ status: 200, description: 'Password changed successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  async changePassword(@Request() req, @Body() changePasswordDto: any) {
    // This would need to be implemented in the AuthService
    // For now, return a placeholder response
    return { message: 'Password change functionality to be implemented' };
  }
  @Put('profile')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update admin profile (excluding password)' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required.',
  })
  async updateProfile(
    @Request() req,
    @Body() updateProfileDto: UpdateAdminProfileDto,
  ) {
    const userId = req.user.id;
    // Explicitly exclude password from updates
    const { ...profileData } = updateProfileDto;

    const updatedUser = await this.usersService.update(userId, profileData);

    // Return the updated user without sensitive information
    const { password, ...userWithoutPassword } = updatedUser;

    return {
      message: 'Profile updated successfully',
      user: userWithoutPassword,
    };
  }
}
