/**
 * In-memory cache with TTL support
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

interface CacheConfig {
  defaultTTL: number; // milliseconds
  maxSize: number; // max entries
}

class MemoryCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private config: CacheConfig;

  constructor(config: CacheConfig) {
    this.config = config;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  set<T>(key: string, value: T, ttl?: number): void {
    // Evict oldest entry if at max size
    if (this.cache.size >= this.config.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (ttl ?? this.config.defaultTTL),
    });
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  // Clean up expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  // Get cache stats
  stats(): { size: number; hits: number; misses: number } {
    return {
      size: this.cache.size,
      hits: 0,
      misses: 0,
    };
  }
}

// Pre-configured caches
export const apiCache = new MemoryCache({
  defaultTTL: 5 * 60 * 1000, // 5 minutes
  maxSize: 1000,
});

export const agentCache = new MemoryCache({
  defaultTTL: 10 * 60 * 1000, // 10 minutes
  maxSize: 100,
});

export const priceCache = new MemoryCache({
  defaultTTL: 30 * 1000, // 30 seconds
  maxSize: 50,
});

export const userCache = new MemoryCache({
  defaultTTL: 2 * 60 * 1000, // 2 minutes
  maxSize: 500,
});

type AsyncFunction<T> = (...args: unknown[]) => Promise<T>;

/**
 * Cache decorator for functions
 */
export function cached<T>(
  cache: MemoryCache,
  keyPrefix: string,
  ttl?: number
): (fn: AsyncFunction<T>) => AsyncFunction<T> {
  return (fn: AsyncFunction<T>) => {
    return async (...args: unknown[]): Promise<T> => {
      const key = `${keyPrefix}:${JSON.stringify(args)}`;
      const cachedValue = cache.get(key);
      
      if (cachedValue !== null) {
        return cachedValue as T;
      }

      const result = await fn(...args);
      cache.set(key, result, ttl);
      return result;
    };
  };
}

/**
 * Create a cached version of a fetcher function
 */
export function createCachedFetcher<T>(
  fetcher: () => Promise<T>,
  cache: MemoryCache,
  key: string,
  ttl?: number
): () => Promise<T> {
  const wrapper = cached<T>(cache, key, ttl);
  return wrapper(fetcher);
}
