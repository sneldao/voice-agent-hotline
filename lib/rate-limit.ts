/**
 * Rate limiter for API routes
 */

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

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

// Pre-configured limiters
export const apiLimiter = new MemoryRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60, // 60 requests per minute
});

export const authLimiter = new MemoryRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10, // 10 attempts per 15 minutes
});

export const sensitiveActionLimiter = new MemoryRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 5, // 5 sensitive actions per hour
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
 * Rate limit middleware helper
 */
export function checkRateLimit(
  limiter: MemoryRateLimiter,
  identifier: string
): { limited: boolean; headers: Record<string, string> } {
  const limited = limiter.isRateLimited(identifier);
  const remaining = limiter.getRemainingRequests(identifier);
  const resetTime = limiter.getResetTime(identifier);
  const headers = createRateLimitHeaders(remaining, resetTime);

  return { limited, headers };
}
