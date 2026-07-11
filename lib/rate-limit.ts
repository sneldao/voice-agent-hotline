/**
 * Rate limiter for API routes with Redis support
 */

import { getRedis } from './redis';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export class RedisRateLimiter {
  private config: RateLimitConfig;
  private keyPrefix: string;

  constructor(config: RateLimitConfig, keyPrefix: string = 'ratelimit') {
    this.config = config;
    this.keyPrefix = keyPrefix;
  }

  private getKey(identifier: string): string {
    return `${this.keyPrefix}:${identifier}`;
  }

  async isRateLimited(identifier: string): Promise<boolean> {
    const redis = getRedis();
    const key = this.getKey(identifier);
    const now = Date.now();

    try {
      const entry = await redis.get<RateLimitEntry>(key);

      if (!entry) {
        // First request
        await redis.setex(key, Math.ceil(this.config.windowMs / 1000), {
          count: 1,
          resetTime: now + this.config.windowMs,
        });
        return false;
      }

      if (now > entry.resetTime) {
        // Window expired, reset
        await redis.setex(key, Math.ceil(this.config.windowMs / 1000), {
          count: 1,
          resetTime: now + this.config.windowMs,
        });
        return false;
      }

      if (entry.count >= this.config.maxRequests) {
        return true;
      }

      // Increment count
      entry.count++;
      const ttl = Math.ceil((entry.resetTime - now) / 1000);
      await redis.setex(key, ttl > 0 ? ttl : 1, entry);
      return false;
    } catch (error) {
      console.error('Rate limiter Redis error:', error);
      // Fallback: allow request if Redis fails
      return false;
    }
  }

  async getRemainingRequests(identifier: string): Promise<number> {
    const redis = getRedis();
    const key = this.getKey(identifier);
    const now = Date.now();

    try {
      const entry = await redis.get<RateLimitEntry>(key);

      if (!entry) {
        return this.config.maxRequests;
      }

      if (now > entry.resetTime) {
        return this.config.maxRequests;
      }

      return Math.max(0, this.config.maxRequests - entry.count);
    } catch (error) {
      console.error('Rate limiter Redis error:', error);
      return this.config.maxRequests;
    }
  }

  async getResetTime(identifier: string): Promise<number> {
    const redis = getRedis();
    const key = this.getKey(identifier);

    try {
      const entry = await redis.get<RateLimitEntry>(key);
      return entry?.resetTime || Date.now();
    } catch (error) {
      console.error('Rate limiter Redis error:', error);
      return Date.now();
    }
  }
}

// Memory fallback for when Redis is not available
class MemoryRateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  isRateLimited(identifier: string): boolean {
    const now = Date.now();
    const entry = this.limits.get(identifier);

    if (!entry) {
      this.limits.set(identifier, {
        count: 1,
        resetTime: now + this.config.windowMs,
      });
      return false;
    }

    if (now > entry.resetTime) {
      // Reset the window
      this.limits.set(identifier, {
        count: 1,
        resetTime: now + this.config.windowMs,
      });
      return false;
    }

    if (entry.count >= this.config.maxRequests) {
      return true;
    }

    entry.count++;
    return false;
  }

  getRemainingRequests(identifier: string): number {
    const now = Date.now();
    const entry = this.limits.get(identifier);

    if (!entry) {
      return this.config.maxRequests;
    }

    if (now > entry.resetTime) {
      return this.config.maxRequests;
    }

    return Math.max(0, this.config.maxRequests - entry.count);
  }

  getResetTime(identifier: string): number {
    const entry = this.limits.get(identifier);
    return entry?.resetTime || Date.now();
  }

  // Cleanup expired entries periodically
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.limits.entries()) {
      if (now > entry.resetTime) {
        this.limits.delete(key);
      }
    }
  }
}

// Pre-configured Redis limiters
export const apiLimiter = new RedisRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60, // 60 requests per minute
}, 'ratelimit:api');

export const authLimiter = new RedisRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10, // 10 attempts per 15 minutes
}, 'ratelimit:auth');

export const sensitiveActionLimiter = new RedisRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 5, // 5 sensitive actions per hour
}, 'ratelimit:sensitive');

// Memory fallback limiters for when Redis is not available
export const memoryApiLimiter = new MemoryRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 60,
});

export const memoryAuthLimiter = new MemoryRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
});

export const memorySensitiveActionLimiter = new MemoryRateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 5,
});

/**
 * Create rate limit headers for response
 */
export function createRateLimitHeaders(
  remaining: number,
  resetTime: number
): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(60),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(Math.ceil(resetTime / 1000)),
  };
}

/**
 * Rate limit middleware helper (async for Redis)
 */
export async function checkRateLimit(
  limiter: RedisRateLimiter,
  identifier: string
): Promise<{ limited: boolean; headers: Record<string, string> }> {
  const limited = await limiter.isRateLimited(identifier);
  const remaining = await limiter.getRemainingRequests(identifier);
  const resetTime = await limiter.getResetTime(identifier);
  const headers = createRateLimitHeaders(remaining, resetTime);

  return { limited, headers };
}

/**
 * Rate limit middleware helper (sync for memory fallback)
 */
export function checkRateLimitSync(
  limiter: MemoryRateLimiter,
  identifier: string
): { limited: boolean; headers: Record<string, string> } {
  const limited = limiter.isRateLimited(identifier);
  const remaining = limiter.getRemainingRequests(identifier);
  const resetTime = limiter.getResetTime(identifier);
  const headers = createRateLimitHeaders(remaining, resetTime);

  return { limited, headers };
}
