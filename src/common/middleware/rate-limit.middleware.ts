import {
  Injectable,
  NestMiddleware,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SecurityLog, SecurityEventType, SecuritySeverity } from '../../admin/entities/security-log.entity';
import { BlockedIp, BlockReason } from '../../admin/entities/blocked-ip.entity';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  blockDuration?: number; // Block duration in milliseconds (optional)
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

interface RequestRecord {
  count: number;
  resetTime: number;
  blocked?: boolean;
  blockExpires?: number;
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RateLimitMiddleware.name);
  private readonly requestCounts = new Map<string, RequestRecord>();
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor(
    @InjectRepository(SecurityLog)
    private securityLogRepository: Repository<SecurityLog>,
    @InjectRepository(BlockedIp)
    private blockedIpRepository: Repository<BlockedIp>,
  ) {
    // Clean up expired records every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const config = this.getRateLimitConfig(req);
    const clientIp = this.getClientIp(req);
    const key = `${clientIp}:${req.path}`;

    const now = Date.now();
    const record = this.requestCounts.get(key) || {
      count: 0,
      resetTime: now + config.windowMs,
    };

    // Check if currently blocked
    if (record.blocked && record.blockExpires && now < record.blockExpires) {
      this.setRateLimitHeaders(res, config, record);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests. IP temporarily blocked.',
          retryAfter: Math.ceil((record.blockExpires - now) / 1000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Reset window if expired
    if (now > record.resetTime) {
      record.count = 0;
      record.resetTime = now + config.windowMs;
      record.blocked = false;
      record.blockExpires = undefined;
    }

    // Increment request count
    record.count++;
    this.requestCounts.set(key, record);

    // Check if limit exceeded
    if (record.count > config.maxRequests) {
      // Block IP if configured
      if (config.blockDuration) {
        record.blocked = true;
        record.blockExpires = now + config.blockDuration;
        this.requestCounts.set(key, record);

        // Log security event and potentially block IP in database
        this.handleRateLimitViolation(clientIp, req, record.count);
      }

      this.setRateLimitHeaders(res, config, record);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests',
          retryAfter: Math.ceil((record.resetTime - now) / 1000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    this.setRateLimitHeaders(res, config, record);
    next();
  }

  private getRateLimitConfig(req: Request): RateLimitConfig {
    const path = req.path;
    const method = req.method;

    // Admin endpoints - stricter limits
    if (path.startsWith('/api/admin')) {
      if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
        return {
          windowMs: 60 * 1000, // 1 minute
          maxRequests: 30, // 30 requests per minute
          blockDuration: 5 * 60 * 1000, // 5 minutes block
        };
      }
      return {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 100, // 100 requests per minute
        blockDuration: 2 * 60 * 1000, // 2 minutes block
      };
    }

    // Auth endpoints - very strict
    if (path.includes('/auth/login') || path.includes('/admin/login')) {
      return {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 5, // 5 login attempts per 15 minutes
        blockDuration: 30 * 60 * 1000, // 30 minutes block
      };
    }

    // General API endpoints
    return {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 200, // 200 requests per minute
      blockDuration: 60 * 1000, // 1 minute block
    };
  }

  private setRateLimitHeaders(
    res: Response,
    config: RateLimitConfig,
    record: RequestRecord,
  ): void {
    const remaining = Math.max(0, config.maxRequests - record.count);
    const resetTime = Math.ceil(record.resetTime / 1000);

    res.setHeader('X-RateLimit-Limit', config.maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetTime);

    if (record.blocked && record.blockExpires) {
      res.setHeader('Retry-After', Math.ceil((record.blockExpires - Date.now()) / 1000));
    }
  }

  private async handleRateLimitViolation(
    ipAddress: string,
    req: Request,
    requestCount: number,
  ): Promise<void> {
    try {
      // Log security event
      await this.securityLogRepository.save({
        eventType: SecurityEventType.RATE_LIMIT_EXCEEDED,
        severity: SecuritySeverity.MEDIUM,
        description: `Rate limit exceeded: ${requestCount} requests from ${ipAddress}`,
        ipAddress,
        metadata: JSON.stringify({
          path: req.path,
          method: req.method,
          userAgent: req.headers['user-agent'],
          requestCount,
        }),
      });

      // Block IP in database if too many violations
      if (requestCount > 100) {
        const existingBlock = await this.blockedIpRepository.findOne({
          where: { ipAddress, isActive: true },
        });

        if (!existingBlock) {
          await this.blockedIpRepository.save({
            ipAddress,
            reason: BlockReason.AUTOMATED_BLOCK,
            description: `Automated block due to rate limit violations (${requestCount} requests)`,
            isActive: true,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
            attemptCount: 0,
          });

          this.logger.warn(`IP ${ipAddress} automatically blocked due to rate limit violations`);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to handle rate limit violation: ${error.message}`);
    }
  }

  private getClientIp(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      (req.headers['x-real-ip'] as string) ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      '127.0.0.1'
    );
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.requestCounts.entries()) {
      if (now > record.resetTime && (!record.blockExpires || now > record.blockExpires)) {
        this.requestCounts.delete(key);
      }
    }
  }

  onModuleDestroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}