import { Redis } from '@upstash/redis';

// Lazy initialization to allow build without env vars
let redisInstance: Redis | null = null;

export function getRedis(): Redis {
  if (!redisInstance) {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      throw new Error('Missing Upstash Redis environment variables');
    }
    redisInstance = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redisInstance;
}

// Export singleton for backward compatibility
export const redis = new Proxy({} as Redis, {
  get(target, prop) {
    const client = getRedis();
    return (client as any)[prop];
  },
});
