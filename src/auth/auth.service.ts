import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { User } from '../users/entities/user.entity';
import { EmailSenderService } from '../emails/email-sender.service';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
 constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly emailSenderService: EmailSenderService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.validateUser(email, password);
    if (!user) {
      return null;
    }
    return user;
  }

  async login(user: User) {
    const payload = { email: user.email, sub: user.id, isAdmin: user.isAdmin };
    const token = this.jwtService.sign(payload, { expiresIn: '2h' });
    const refreshToken = this.jwtService.sign(
      { sub: user.id, type: 'refresh' },
      { expiresIn: '7d' }
    );
    
    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isAdmin: user.isAdmin,
        isActive: user.isActive,
        verifiedEmail: user.verifiedEmail, // Use verifiedEmail as the field name
      },
      token,
      refreshToken,
      expiresIn: 7200, // 2 hour in seconds
    };
  }

  async loginWithCredentials(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    
    // Check if user's email is verified
    if (!user.verifiedEmail) {
      throw new UnauthorizedException('Please verify your email address before logging in. Check your inbox for the verification email.');
    }
    
    return this.login(user);
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken);
      
      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid refresh token type');
      }
      
      const user = await this.usersService.findOne(payload.sub);
      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or inactive');
      }
      
      return this.login(user);
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async validateToken(token: string) {
    try {
      const payload = this.jwtService.verify(token);
      const user = await this.usersService.findOne(payload.sub);
      return user;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const users = await this.usersService.findAll();
    const user = users.find(u => u.verifyToken === token && u.verifyTokenExpires && u.verifyTokenExpires > new Date());
    
    if (!user) {
      throw new BadRequestException('Token de vérification invalide ou expiré');
    }
    
    await this.usersService.update(user.id, { verifiedEmail: true });
    await this.usersService.clearVerificationTokens(user.id);
    
    return { message: 'Email vérifié avec succès' };
  }

  async verifyEmailCode(code: string, email?: string): Promise<{ message: string }> {
    const users = await this.usersService.findAll();
    let user = users.find(u => u.verifyCode === code && u.verifyCodeExpires && u.verifyCodeExpires > new Date());
    
    // Si l'email est fourni, vérifier qu'il correspond
    if (email && user && user.email !== email) {
      user = undefined;
    }
    
    if (!user) {
      throw new BadRequestException('Code de vérification invalide ou expiré');
    }
    
    await this.usersService.update(user.id, { verifiedEmail: true });
    await this.usersService.clearVerificationTokens(user.id);
    
    return { message: 'Email vérifié avec succès' };
  }

  async resendVerificationEmail(email: string): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(email);
    
    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }
    
    if (user.verifiedEmail) {
      throw new BadRequestException('Email déjà vérifié');
    }
    
    // Générer un nouveau token et code de vérification
    const verifyToken = await this.usersService.generateVerificationToken(user.id);
    const verifyCode = await this.usersService.generateVerificationCode(user.id);
    
    // Envoyer l'email de vérification avec les deux options
    await this.emailSenderService.sendVerificationEmail(user.email, verifyToken, verifyCode);
    
    return { message: 'Email de vérification renvoyé' };
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(email);
    
    if (!user) {
      // Ne pas révéler si l'email existe ou non pour des raisons de sécurité
      return { message: 'Si cet email existe, un lien de réinitialisation a été envoyé' };
    }
    
    // Générer un token de réinitialisation
    const resetToken = await this.usersService.generatePasswordResetToken(user.id);
    
    // Envoyer l'email de réinitialisation
    await this.emailSenderService.sendPasswordResetEmail(user.email, resetToken);
    
    return { message: 'Si cet email existe, un lien de réinitialisation a été envoyé' };
  }

  async verifyResetCode(code: string): Promise<{ message: string }> {
    const users = await this.usersService.findAll();
    const user = users.find(u => u.resetPasswordCode === code && u.resetPasswordCodeExpires && u.resetPasswordCodeExpires > new Date());
    
    if (!user) {
      throw new BadRequestException('Code de réinitialisation invalide ou expiré');
    }
    
    return { message: 'Code de réinitialisation valide' };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const users = await this.usersService.findAll();
    const user = users.find(u => u.resetPasswordToken === token && u.resetPasswordExpires && u.resetPasswordExpires > new Date());
    
    if (!user) {
      throw new BadRequestException('Token de réinitialisation invalide ou expiré');
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.usersService.update(user.id, { password: hashedPassword });
    await this.usersService.clearPasswordResetTokens(user.id);
    
    return { message: 'Mot de passe réinitialisé avec succès' };
  }
}