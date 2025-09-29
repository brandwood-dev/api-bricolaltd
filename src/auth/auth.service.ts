import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { User } from '../users/entities/user.entity';
import { SendGridService } from '../emails/sendgrid.service';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly sendGridService: SendGridService,
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
    
    // 24h token expiration for all users (admin and regular users)
    const tokenExpiration = '24h';
    const expiresInSeconds = 86400; // 24h = 86400s
    
    const token = this.jwtService.sign(payload, { expiresIn: tokenExpiration });
    const refreshToken = this.jwtService.sign(
      { sub: user.id, type: 'refresh' },
      { expiresIn: '7d' },
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isAdmin: user.isAdmin,
        isActive: user.isActive,
        verifiedEmail: user.verifiedEmail,
        profilePicture: user.profilePicture,
        countryId: user.countryId,
        address: user.address,
        
      },
      token,
      refreshToken,
      expiresIn: expiresInSeconds,
    };
  }

  async loginWithCredentials(loginDto: LoginDto) {
    console.log('=== DEBUG loginWithCredentials ===');
    console.log('Email reçu:', loginDto.email);
    console.log('Password reçu:', loginDto.password ? '[MASQUÉ]' : 'VIDE');

    const user = await this.validateUser(loginDto.email, loginDto.password);
    console.log(
      'Utilisateur retourné par validateUser:',
      user ? 'TROUVÉ' : 'NON TROUVÉ',
    );

    if (!user) {
      console.log('ERREUR: Utilisateur non trouvé ou mot de passe incorrect');
      throw new UnauthorizedException('Invalid credentials');
    }

    console.log('Statut utilisateur:', {
      id: user.id,
      email: user.email,
      verifiedEmail: user.verifiedEmail,
      isActive: user.isActive,
    });

    // Check if user is suspended
    if (user.isSuspended) {
      console.log('ERREUR: Utilisateur suspendu');
      throw new UnauthorizedException(
        `Your account access has been suspended. Reason: ${user.isSuspended}. You cannot access the application.`,
      );
    }

    // Check if user's email is verified
    // Exception: Allow login if user recently reset password (resetPasswordToken exists)
    if (!user.verifiedEmail && !user.resetPasswordToken) {
      console.log('ERREUR: Email non vérifié');
      throw new UnauthorizedException(
        'Please verify your email address before logging in. Check your inbox for the verification email.',
      );
    }

    // If user has resetPasswordToken, clear it after successful login
    if (user.resetPasswordToken) {
      console.log(
        'Utilisateur connecté après réinitialisation de mot de passe, nettoyage du token',
      );
      await this.usersService.clearPasswordResetTokens(user.id);
    }

    console.log('Connexion réussie, génération du token');
    console.log('=== FIN DEBUG loginWithCredentials ===');
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
    const user = users.find(
      (u) =>
        u.verifyToken === token &&
        u.verifyTokenExpires &&
        u.verifyTokenExpires > new Date(),
    );

    if (!user) {
      throw new BadRequestException('Token de vérification invalide ou expiré');
    }

    await this.usersService.update(user.id, { verifiedEmail: true });
    await this.usersService.clearVerificationTokens(user.id);

    return { message: 'Email vérifié avec succès' };
  }

  async verifyEmailCode(
    code: string,
    email?: string,
  ): Promise<{ message: string }> {
    const users = await this.usersService.findAll();
    let user = users.find(
      (u) =>
        u.verifyCode === code &&
        u.verifyCodeExpires &&
        u.verifyCodeExpires > new Date(),
    );

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

    // Générer uniquement le code de vérification
    const verifyCode = await this.usersService.generateVerificationCode(
      user.id,
    );

    // Envoyer l'email de vérification avec SendGrid (code uniquement)
    await this.sendGridService.sendVerificationEmail(user.email, verifyCode);

    return { message: 'Email de vérification renvoyé' };
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      // Ne pas révéler si l'email existe ou non pour des raisons de sécurité
      return {
        message:
          'Si cet email existe, un code de réinitialisation a été envoyé',
      };
    }

    // Générer un code de réinitialisation
    const resetCode = await this.usersService.generatePasswordResetCode(
      user.id,
    );

    // Envoyer l'email de réinitialisation
    await this.sendGridService.sendPasswordResetEmail(user.email, resetCode);

    return {
      message: 'Si cet email existe, un code de réinitialisation a été envoyé',
    };
  }

  async verifyResetCode(
    code: string,
    email: string,
  ): Promise<{ message: string; resetToken: string }> {
    console.log('=== DEBUG verifyResetCode ===');
    console.log('Code reçu:', code, 'Type:', typeof code);
    console.log('Email reçu:', email);

    const users = await this.usersService.findAll();
    console.log("Nombre d'utilisateurs trouvés:", users.length);

    // Trouver l'utilisateur par email d'abord
    const userByEmail = users.find((u) => u.email === email);
    if (userByEmail) {
      console.log('Utilisateur trouvé pour email:', {
        id: userByEmail.id,
        email: userByEmail.email,
        resetPasswordCode: userByEmail.resetPasswordCode,
        resetPasswordCodeExpires: userByEmail.resetPasswordCodeExpires,
        codeType: typeof userByEmail.resetPasswordCode,
      });

      // Vérifier l'expiration
      const now = new Date();
      console.log('Date actuelle:', now);
      console.log(
        'Code expiré?',
        userByEmail.resetPasswordCodeExpires
          ? userByEmail.resetPasswordCodeExpires <= now
          : "Pas de date d'expiration",
      );

      // Vérifier la comparaison du code
      console.log('Comparaison codes:');
      console.log('  Code reçu:', `"${code}"`);
      console.log('  Code stocké:', `"${userByEmail.resetPasswordCode}"`);
      console.log('  Égaux?', code === userByEmail.resetPasswordCode);
      console.log(
        '  Égaux (string)?',
        String(code) === String(userByEmail.resetPasswordCode),
      );
    } else {
      console.log("Aucun utilisateur trouvé pour l'email:", email);
    }

    const user = users.find(
      (u) =>
        u.resetPasswordCode === code &&
        u.resetPasswordCodeExpires &&
        u.resetPasswordCodeExpires > new Date() &&
        u.email === email,
    );
    console.log('Utilisateur final trouvé:', user ? 'OUI' : 'NON');
    console.log('=== FIN DEBUG ===');

    if (!user) {
      throw new BadRequestException(
        'Code de réinitialisation invalide ou expiré',
      );
    }

    // Générer un token temporaire pour la réinitialisation
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Sauvegarder le token temporaire
    await this.usersService.update(user.id, {
      resetPasswordToken: resetToken,
      resetPasswordExpires: resetTokenExpires,
    });

    return { message: 'Code de réinitialisation valide', resetToken };
  }

  async resendResetCode(email: string): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      // Ne pas révéler si l'email existe ou non pour des raisons de sécurité
      return {
        message:
          'Si cet email existe, un nouveau code de réinitialisation a été envoyé',
      };
    }

    // Générer un nouveau code de réinitialisation
    const resetCode = await this.usersService.generatePasswordResetCode(
      user.id,
    );

    // Envoyer l'email de réinitialisation
    await this.sendGridService.sendPasswordResetEmail(user.email, resetCode);

    return {
      message:
        'Si cet email existe, un nouveau code de réinitialisation a été envoyé',
    };
  }

  async resetPassword(
    tokenOrCode: string,
    newPassword: string,
    isToken: boolean = true,
  ): Promise<{ message: string }> {
    console.log('=== DEBUG resetPassword ===');
    console.log('Token/Code reçu:', tokenOrCode);
    console.log(
      'Nouveau mot de passe:',
      newPassword ? '[MASQUÉ - longueur: ' + newPassword.length + ']' : 'VIDE',
    );
    console.log('Mode token:', isToken);

    const users = await this.usersService.findAll();
    let user;

    if (isToken) {
      // Recherche par token de réinitialisation
      user = users.find(
        (u) =>
          u.resetPasswordToken === tokenOrCode &&
          u.resetPasswordExpires &&
          u.resetPasswordExpires > new Date(),
      );
    } else {
      // Recherche par code de réinitialisation
      user = users.find(
        (u) =>
          u.resetPasswordCode === tokenOrCode &&
          u.resetPasswordCodeExpires &&
          u.resetPasswordCodeExpires > new Date(),
      );
    }

    console.log(
      'Utilisateur trouvé pour réinitialisation:',
      user ? 'OUI' : 'NON',
    );

    if (!user) {
      console.log('ERREUR: Token ou code invalide/expiré');
      throw new BadRequestException(
        'Token ou code de réinitialisation invalide ou expiré',
      );
    }

    console.log('Utilisateur à mettre à jour:', {
      id: user.id,
      email: user.email,
      ancienPasswordHash: user.password
        ? user.password.substring(0, 20) + '...'
        : 'VIDE',
    });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    console.log(
      'Nouveau hash généré:',
      hashedPassword.substring(0, 20) + '...',
    );

    await this.usersService.updateWithHashedPassword(user.id, hashedPassword);
    console.log('Mot de passe mis à jour dans la base de données');

    await this.usersService.clearPasswordResetTokens(user.id);
    console.log('Tokens de réinitialisation effacés');

    console.log('=== FIN DEBUG resetPassword ===');
    return { message: 'Mot de passe réinitialisé avec succès' };
  }

  async validateUserPassword(userId: string, password: string): Promise<boolean> {
    try {
      console.log('🔍 === BACKEND validateUserPassword DEBUG ===');
      console.log('📥 Input parameters:', {
        userId: userId,
        passwordLength: password ? password.length : 0,
        passwordExists: !!password,
        passwordType: typeof password
      });
      
      console.log('🔎 Searching for user in database...');
      const user = await this.usersService.findOne(userId);
      console.log('👤 User lookup result:', {
        userFound: !!user,
        userId: user?.id,
        userEmail: user?.email,
        hasPassword: user ? !!user.password : false,
        passwordHashLength: user?.password ? user.password.length : 0
      });
      
      if (!user || !user.password) {
        console.log('❌ VALIDATION FAILED: User not found or no password hash');
        console.log('🔍 Debug details:', {
          userExists: !!user,
          userHasPassword: user ? !!user.password : 'N/A',
          userPasswordValue: user?.password ? 'EXISTS' : 'NULL/UNDEFINED'
        });
        return false;
      }
      
      console.log('🔐 Password hash details:', {
        hashPrefix: user.password.substring(0, 29), // Show bcrypt prefix $2b$10$
        hashLength: user.password.length,
        isValidBcryptFormat: user.password.startsWith('$2b$') || user.password.startsWith('$2a$')
      });
      
      console.log('🔄 Starting bcrypt comparison...');
      console.log('📝 Comparison inputs:', {
        plainTextLength: password.length,
        hashLength: user.password.length,
        timestamp: new Date().toISOString()
      });
      
      const isValid = await bcrypt.compare(password, user.password);
      
      console.log('✅ Bcrypt comparison result:', {
        isValid: isValid,
        comparisonSuccessful: true,
        timestamp: new Date().toISOString()
      });
      console.log('🔍 === END validateUserPassword DEBUG ===');
      
      return isValid;
    } catch (error) {
      console.error('❌ ERROR in validateUserPassword:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        userId: userId,
        passwordProvided: !!password
      });
      console.log('🔍 === END validateUserPassword DEBUG (ERROR) ===');
      return false;
    }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ message: string }> {
    try {
      console.log('=== DEBUG changePassword ===');
      console.log('UserId:', userId);
      console.log('Current password:', currentPassword ? '[MASQUÉ - longueur: ' + currentPassword.length + ']' : 'VIDE');
      console.log('New password:', newPassword ? '[MASQUÉ - longueur: ' + newPassword.length + ']' : 'VIDE');
      
      // Vérifier le mot de passe actuel
      const isCurrentPasswordValid = await this.validateUserPassword(userId, currentPassword);
      console.log('Mot de passe actuel valide:', isCurrentPasswordValid);
      
      if (!isCurrentPasswordValid) {
        console.log('ERREUR: Mot de passe actuel invalide');
        throw new BadRequestException('Le mot de passe actuel est incorrect');
      }
      
      // Hacher le nouveau mot de passe avec la même méthode que lors de l'inscription
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      console.log('Nouveau hash généré:', hashedNewPassword.substring(0, 20) + '...');
      
      // Mettre à jour le mot de passe dans la base de données
      await this.usersService.updateWithHashedPassword(userId, hashedNewPassword);
      console.log('Mot de passe mis à jour avec succès');
      
      console.log('=== FIN DEBUG changePassword ===');
      return { message: 'Mot de passe modifié avec succès' };
    } catch (error) {
      console.log('ERREUR dans changePassword:', error.message);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Erreur lors du changement de mot de passe');
    }
  }
}
