import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { SecurityLog, SecurityEventType, SecuritySeverity } from '../../admin/entities/security-log.entity';
import { BlockedIp } from '../../admin/entities/blocked-ip.entity';
import { ADMIN_PERMISSIONS_KEY } from '../decorators/admin-permissions.decorator';
import { Request } from 'express';

@Injectable()
export class EnhancedAdminGuard implements CanActivate {
  private readonly logger = new Logger(EnhancedAdminGuard.name);

  constructor(
    private reflector: Reflector,
    private jwtService: JwtService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(SecurityLog)
    private securityLogRepository: Repository<SecurityLog>,
    @InjectRepository(BlockedIp)
    private blockedIpRepository: Repository<BlockedIp>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const clientIp = this.getClientIp(request);

    try {
      // Check if IP is blocked
      await this.checkIpBlocked(clientIp);

      // Validate JWT token
      const user = await this.validateToken(request);

      // Check if user is admin
      if (!user.isAdmin) {
        await this.logSecurityEvent({
          eventType: SecurityEventType.UNAUTHORIZED_ACCESS,
          severity: SecuritySeverity.HIGH,
          description: `Non-admin user attempted to access admin endpoint: ${request.path}`,
          ipAddress: clientIp,
          userId: user.id,
          metadata: JSON.stringify({
            endpoint: request.url,
            method: request.method,
            userAgent: request.headers['user-agent'],
          }),
        });
        throw new ForbiddenException('Admin access required');
      }

      // Check specific permissions if required
      const requiredPermissions = this.reflector.get<string[]>(
        ADMIN_PERMISSIONS_KEY,
        context.getHandler(),
      );

      if (requiredPermissions && !this.hasPermissions(user, requiredPermissions)) {
        await this.logSecurityEvent({
          eventType: SecurityEventType.UNAUTHORIZED_ACCESS,
          severity: SecuritySeverity.MEDIUM,
          description: `Admin user lacks required permissions: ${requiredPermissions.join(', ')}`,
          ipAddress: clientIp,
          userId: user.id,
          metadata: JSON.stringify({
            requiredPermissions,
            endpoint: request.url,
            method: request.method,
          }),
        });
        throw new ForbiddenException(
          `Insufficient permissions. Required: ${requiredPermissions.join(', ')}`,
        );
      }

      // Log successful admin access
      await this.logSecurityEvent({
        eventType: SecurityEventType.ADMIN_ACCESS,
        severity: SecuritySeverity.LOW,
        description: `Admin accessed endpoint: ${request.path}`,
        ipAddress: clientIp,
        userId: user.id,
        metadata: JSON.stringify({
          endpoint: request.url,
          method: request.method,
          userAgent: request.headers['user-agent'],
        }),
      });

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error('Error in EnhancedAdminGuard:', error);
      throw new UnauthorizedException('Authentication failed');
    }
  }

  private async checkIpBlocked(ipAddress: string): Promise<void> {
    const blockedIp = await this.blockedIpRepository.findOne({
      where: { ipAddress, isActive: true },
    });

    if (blockedIp) {
      // Check if block has expired
      if (blockedIp.expiresAt && blockedIp.expiresAt < new Date()) {
        blockedIp.isActive = false;
        await this.blockedIpRepository.save(blockedIp);
        return;
      }

      // Update attempt count
      blockedIp.attemptCount += 1;
      blockedIp.lastAttemptAt = new Date();
      await this.blockedIpRepository.save(blockedIp);

      throw new ForbiddenException('IP address is blocked');
    }
  }

  private async validateToken(request: Request): Promise<User> {
    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const payload = this.jwtService.verify(token);
      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
        relations: ['country'],
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      if (!user.isActive) {
        throw new UnauthorizedException('User account is deactivated');
      }

      return user;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  private getClientIp(request: Request): string {
    return (
      (request.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      (request.headers['x-real-ip'] as string) ||
      request.connection.remoteAddress ||
      request.socket.remoteAddress ||
      '127.0.0.1'
    );
  }

  private hasPermissions(user: User, requiredPermissions: string[]): boolean {
    // For now, all admin users have all permissions
    // This can be extended with a proper permission system
    return user.isAdmin;
  }

  private async logSecurityEvent(eventData: Partial<SecurityLog>): Promise<void> {
    try {
      const securityLog = this.securityLogRepository.create(eventData);
      await this.securityLogRepository.save(securityLog);
    } catch (error) {
      this.logger.error('Failed to log security event:', error);
    }
  }
}