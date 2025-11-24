import { Injectable, Logger } from '@nestjs/common';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

@Injectable()
export class WebhookRateLimitService {
  private readonly logger = new Logger(WebhookRateLimitService.name);
  private readonly rateLimits = new Map<string, RateLimitEntry>();

  // Rate limits configuration
  private readonly limits = {
    global: { maxRequests: 100, windowMs: 60000 }, // 100 requests per minute
    perIp: { maxRequests: 30, windowMs: 60000 }, // 30 requests per minute per IP
    perEvent: { maxRequests: 10, windowMs: 60000 }, // 10 requests per minute per event type
  };

  /**
   * Check if request is within rate limits
   */
  async isWithinRateLimits(
    ipAddress: string,
    eventType?: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    try {
      // Check global rate limit
      const globalResult = this.checkRateLimit('global', this.limits.global);
      if (!globalResult.allowed) {
        return { allowed: false, reason: 'Global rate limit exceeded' };
      }

      // Check per-IP rate limit
      const ipResult = this.checkRateLimit(
        `ip:${ipAddress}`,
        this.limits.perIp,
      );
      if (!ipResult.allowed) {
        return { allowed: false, reason: 'IP rate limit exceeded' };
      }

      // Check per-event rate limit if event type is provided
      if (eventType) {
        const eventResult = this.checkRateLimit(
          `event:${eventType}`,
          this.limits.perEvent,
        );
        if (!eventResult.allowed) {
          return {
            allowed: false,
            reason: `Rate limit exceeded for event type: ${eventType}`,
          };
        }
      }

      return { allowed: true };
    } catch (error) {
      this.logger.error('Error checking rate limits:', error);
      // In case of error, allow the request but log it
      return { allowed: true };
    }
  }

  /**
   * Check a specific rate limit
   */
  private checkRateLimit(
    key: string,
    limit: { maxRequests: number; windowMs: number },
  ): { allowed: boolean; remaining?: number; resetTime?: number } {
    const now = Date.now();
    const entry = this.rateLimits.get(key);

    if (!entry || now >= entry.resetTime) {
      // Create new entry or reset expired one
      const newEntry: RateLimitEntry = {
        count: 1,
        resetTime: now + limit.windowMs,
      };
      this.rateLimits.set(key, newEntry);

      return {
        allowed: true,
        remaining: limit.maxRequests - 1,
        resetTime: newEntry.resetTime,
      };
    }

    if (entry.count >= limit.maxRequests) {
      // Rate limit exceeded
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
      };
    }

    // Increment counter
    entry.count++;

    return {
      allowed: true,
      remaining: limit.maxRequests - entry.count,
      resetTime: entry.resetTime,
    };
  }

  /**
   * Clean up expired rate limit entries
   */
  cleanupExpiredEntries(): void {
    try {
      const now = Date.now();
      let cleanedCount = 0;

      for (const [key, entry] of this.rateLimits.entries()) {
        if (now >= entry.resetTime) {
          this.rateLimits.delete(key);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        this.logger.log(
          `Cleaned up ${cleanedCount} expired rate limit entries`,
        );
      }
    } catch (error) {
      this.logger.error('Error cleaning up expired rate limit entries:', error);
    }
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(
    ipAddress: string,
    eventType?: string,
  ): Record<string, any> {
    try {
      const now = Date.now();
      const status: Record<string, any> = {};

      // Global status
      const globalEntry = this.rateLimits.get('global');
      status.global = {
        current: globalEntry?.count || 0,
        limit: this.limits.global.maxRequests,
        remaining: globalEntry
          ? Math.max(0, this.limits.global.maxRequests - globalEntry.count)
          : this.limits.global.maxRequests,
        resetTime: globalEntry?.resetTime || now,
      };

      // IP status
      const ipEntry = this.rateLimits.get(`ip:${ipAddress}`);
      status.ip = {
        current: ipEntry?.count || 0,
        limit: this.limits.perIp.maxRequests,
        remaining: ipEntry
          ? Math.max(0, this.limits.perIp.maxRequests - ipEntry.count)
          : this.limits.perIp.maxRequests,
        resetTime: ipEntry?.resetTime || now,
      };

      // Event status
      if (eventType) {
        const eventEntry = this.rateLimits.get(`event:${eventType}`);
        status.event = {
          current: eventEntry?.count || 0,
          limit: this.limits.perEvent.maxRequests,
          remaining: eventEntry
            ? Math.max(0, this.limits.perEvent.maxRequests - eventEntry.count)
            : this.limits.perEvent.maxRequests,
          resetTime: eventEntry?.resetTime || now,
        };
      }

      return status;
    } catch (error) {
      this.logger.error('Error getting rate limit status:', error);
      return {};
    }
  }

  /**
   * Reset rate limits for a specific key (useful for testing or manual reset)
   */
  resetRateLimit(key: string): void {
    this.rateLimits.delete(key);
    this.logger.log(`Rate limit reset for key: ${key}`);
  }

  /**
   * Reset all rate limits (use with caution)
   */
  resetAllRateLimits(): void {
    this.rateLimits.clear();
    this.logger.log('All rate limits reset');
  }
}
