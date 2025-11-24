import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Request,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ValidatePasswordDto } from './dto/validate-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { AdminNotificationsService } from '../admin/admin-notifications.service';
import {
  NotificationType as AdminNotificationType,
  NotificationPriority as AdminNotificationPriority,
  NotificationCategory as AdminNotificationCategory,
} from '../admin/dto/admin-notifications.dto';
import { UsersService } from '../users/users.service';
import { SendGridService } from '../emails/sendgrid.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly sendGridService: SendGridService,
    private readonly adminNotificationsService: AdminNotificationsService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User successfully registered.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 409, description: 'Email already exists.' })
  async register(@Body() createUserDto: CreateUserDto) {
    const user = await this.usersService.create(createUserDto);

    // Générer uniquement le code de vérification
    const verifyCode = await this.usersService.generateVerificationCode(
      user.id,
    );

    // Envoyer l'email avec SendGrid (code uniquement)
    await this.sendGridService.sendVerificationEmail(user.email, verifyCode);

    // Émettre une notification admin pour la création de compte utilisateur
    try {
      await this.adminNotificationsService.createAdminNotification({
        title: 'Nouvelle inscription utilisateur',
        message: `Utilisateur ${user.firstName} ${user.lastName} (${user.email}) s'est inscrit.`,
        type: AdminNotificationType.SUCCESS,
        priority: AdminNotificationPriority.MEDIUM,
        category: AdminNotificationCategory.USER,
        userId: user.id,
        userName: `${user.firstName} ${user.lastName}`,
      });
    } catch (e) {
      // Ne pas bloquer l'inscription si la notification échoue
    }

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
    const userWithRelations = await this.usersService.findOneWithRelations(
      req.user.id,
    );
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
  @ApiResponse({
    status: 400,
    description: 'User not found or already verified.',
  })
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
  async verifyResetCode(@Body() body: { email: string; code: string }) {
    return this.authService.verifyResetCode(body.code, body.email);
  }

  @Post('resend-reset-code')
  @ApiOperation({ summary: 'Resend password reset code' })
  @ApiResponse({ status: 200, description: 'Password reset code resent.' })
  @ApiResponse({ status: 400, description: 'User not found.' })
  async resendResetCode(@Body() body: { email: string }) {
    return this.authService.resendResetCode(body.email);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiResponse({ status: 200, description: 'Password reset successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid token or password.' })
  async resetPassword(
    @Body() body: { resetToken: string; newPassword: string },
  ) {
    return this.authService.resetPassword(
      body.resetToken,
      body.newPassword,
      true,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('verify')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify JWT token and return user data' })
  @ApiResponse({
    status: 200,
    description: 'Token is valid, return user data.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid token.' })
  async verifyToken(@Request() req) {
    // Return the user data from the JWT token
    const userWithRelations = await this.usersService.findOneWithRelations(
      req.user.id,
    );
    return userWithRelations;
  }

  @Post('check-email')
  @ApiOperation({ summary: 'Check if email already exists' })
  @ApiResponse({ status: 200, description: 'Email availability checked.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  async checkEmail(@Body() body: { email: string }) {
    const exists = await this.usersService.findByEmail(body.email);
    return {
      exists: !!exists,
      message: exists ? 'Email already exists' : 'Email is available',
    };
  }

  @Post('get-user-info')
  @ApiOperation({ summary: 'Get user information by email' })
  @ApiResponse({ status: 200, description: 'User information retrieved.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async getUserInfo(@Body() body: { email: string }) {
    const user = await this.usersService.findByEmail(body.email);
    if (!user) {
      return { found: false, message: 'Utilisateur non trouvé' };
    }
    return {
      found: true,
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      },
    };
  }

  @Post('validate-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Valider le mot de passe de l'utilisateur" })
  @ApiResponse({ status: 200, description: 'Validation réussie' })
  @ApiResponse({
    status: 400,
    description: 'Mot de passe manquant ou invalide',
  })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  async validatePassword(
    @Request() req,
    @Body() validatePasswordDto: ValidatePasswordDto,
  ) {
    try {
      console.log('=== BACKEND PASSWORD VALIDATION DEBUG ===');
      console.log('Timestamp:', new Date().toISOString());
      console.log('Request headers:', {
        'content-type': req.headers['content-type'],
        authorization: req.headers.authorization
          ? `Bearer ${req.headers.authorization.substring(7, 27)}...`
          : 'Missing',
        'user-agent': req.headers['user-agent'],
      });
      console.log('Request body received:', {
        password: validatePasswordDto.password
          ? `[MASKED - length: ${validatePasswordDto.password.length}]`
          : 'EMPTY',
        hasPassword: !!validatePasswordDto.password,
      });
      console.log('JWT User from token:', {
        id: req.user.id,
        email: req.user.email,
        isAdmin: req.user.isAdmin,
      });

      console.log('Calling authService.validateUserPassword...');
      const isValid = await this.authService.validateUserPassword(
        req.user.id,
        validatePasswordDto.password,
      );
      console.log('✅ Result from validateUserPassword:', isValid);

      const response = {
        success: true,
        data: { valid: isValid },
        message: isValid ? 'Mot de passe valide' : 'Mot de passe invalide',
      };

      console.log('📤 Response being sent:', JSON.stringify(response, null, 2));
      console.log('=== END BACKEND PASSWORD VALIDATION DEBUG ===');

      return response;
    } catch (error) {
      console.error('❌ ERREUR dans validate-password endpoint:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
      console.log('=== END BACKEND PASSWORD VALIDATION DEBUG (ERROR) ===');
      throw new BadRequestException(
        'Erreur lors de la validation du mot de passe',
      );
    }
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Changer le mot de passe de l'utilisateur" })
  @ApiResponse({ status: 200, description: 'Mot de passe changé avec succès' })
  @ApiResponse({
    status: 400,
    description:
      'Mot de passe actuel incorrect ou nouveau mot de passe invalide',
  })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  async changePassword(
    @Request() req,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    try {
      console.log('=== DEBUG change-password endpoint ===');
      console.log('User ID:', req.user.id);
      console.log(
        'Current password received:',
        changePasswordDto.currentPassword
          ? '[MASQUÉ - longueur: ' +
              changePasswordDto.currentPassword.length +
              ']'
          : 'VIDE',
      );
      console.log(
        'New password received:',
        changePasswordDto.newPassword
          ? '[MASQUÉ - longueur: ' + changePasswordDto.newPassword.length + ']'
          : 'VIDE',
      );

      const result = await this.authService.changePassword(
        req.user.id,
        changePasswordDto.currentPassword,
        changePasswordDto.newPassword,
      );

      const response = {
        success: true,
        data: result,
        message: result.message,
      };

      console.log('Response being sent:', JSON.stringify(response, null, 2));
      console.log('=== FIN DEBUG change-password endpoint ===');

      return response;
    } catch (error) {
      console.log('ERREUR dans change-password endpoint:', error.message);
      throw error;
    }
  }
}
