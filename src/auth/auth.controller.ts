import { Controller, Post, Body, UseGuards, Get, Request, Query } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UsersService } from '../users/users.service';
import { SendGridService } from '../emails/sendgrid.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly sendGridService: SendGridService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User successfully registered.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 409, description: 'Email already exists.' })
  async register(@Body() createUserDto: CreateUserDto) {
    const user = await this.usersService.create(createUserDto);
    
    // Générer uniquement le code de vérification
    const verifyCode = await this.usersService.generateVerificationCode(user.id);
    
    // Envoyer l'email avec SendGrid (code uniquement)
    await this.sendGridService.sendVerificationEmail(user.email, verifyCode);
    
    return this.authService.login(user);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'User successfully logged in.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.loginWithCredentials(loginDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the current user profile' })
  @ApiResponse({ status: 200, description: 'Return the user profile.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getProfile(@Request() req) {
    // Fetch user with relations needed for stats calculation
    const userWithRelations = await this.usersService.findOneWithRelations(req.user.id);
    return userWithRelations;
  }

  @Post('verify-email')
  @ApiOperation({ summary: 'Verify email with token' })
  @ApiResponse({ status: 200, description: 'Email verified successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token.' })
  async verifyEmail(@Body() body: { token: string }) {
    return this.authService.verifyEmail(body.token);
  }

  @Post('verify-email-code')
  @ApiOperation({ summary: 'Verify email with code' })
  @ApiResponse({ status: 200, description: 'Email verified successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid code.' })
  async verifyEmailCode(@Body() body: { code: string; email?: string }) {
    return this.authService.verifyEmailCode(body.code, body.email);
  }

  @Post('resend-verification')
  @ApiOperation({ summary: 'Resend verification email' })
  @ApiResponse({ status: 200, description: 'Verification email sent.' })
  @ApiResponse({ status: 400, description: 'User not found or already verified.' })
  async resendVerification(@Body() body: { email: string }) {
    return this.authService.resendVerificationEmail(body.email);
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Request password reset' })
  @ApiResponse({ status: 200, description: 'Password reset email sent.' })
  @ApiResponse({ status: 400, description: 'User not found.' })
  async forgotPassword(@Body() body: { email: string }) {
    return this.authService.forgotPassword(body.email);
  }

  @Post('verify-reset-code')
  @ApiOperation({ summary: 'Verify password reset code' })
  @ApiResponse({ status: 200, description: 'Reset code verified.' })
  @ApiResponse({ status: 400, description: 'Invalid code.' })
  async verifyResetCode(@Body() body: { code: string }) {
    return this.authService.verifyResetCode(body.code);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiResponse({ status: 200, description: 'Password reset successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid token or password.' })
  async resetPassword(@Body() body: { token: string; newPassword: string }) {
    return this.authService.resetPassword(body.token, body.newPassword);
  }

  @UseGuards(JwtAuthGuard)
  @Get('verify')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify JWT token and return user data' })
  @ApiResponse({ status: 200, description: 'Token is valid, return user data.' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid token.' })
  async verifyToken(@Request() req) {
    // Return the user data from the JWT token
    const userWithRelations = await this.usersService.findOneWithRelations(req.user.id);
    return userWithRelations;
  }

  @Post('check-email')
  @ApiOperation({ summary: 'Check if email already exists' })
  @ApiResponse({ status: 200, description: 'Email availability checked.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  async checkEmail(@Body() body: { email: string }) {
    const exists = await this.usersService.findByEmail(body.email);
    return { exists: !!exists, message: exists ? 'Email already exists' : 'Email is available' };
  }
}