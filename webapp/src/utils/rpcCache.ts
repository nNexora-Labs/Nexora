/**
 * RPC Response Caching Utility
 * Reduces API calls by caching blockchain data
 */

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class RPCCache {
  private cache = new Map<string, CacheEntry>();
  private readonly DEFAULT_TTL = 30000; // 30 seconds

  /**
   * Get cached data if still valid
   */
  get(key: string): any | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if cache entry is expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    console.log('📦 Cache hit for:', key);
    return entry.data;
  }

  /**
   * Store data in cache
   */
  set(key: string, data: any, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
    console.log('💾 Cached data for:', key, 'TTL:', ttl + 'ms');
  }

  /**
   * Clear expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    console.log('🗑️ RPC cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Global cache instance
export const rpcCache = new RPCCache();

/**
 * Generate cache key for contract calls
 */
export const generateCacheKey = (
  contractAddress: string,
  functionName: string,
  args: any[] = [],
  userAddress?: string
): string => {
  const argsStr = JSON.stringify(args);
  const userStr = userAddress ? `_${userAddress}` : '';
  return `${contractAddress}_${functionName}_${argsStr}${userStr}`;
};

/**
 * Cache TTL constants (in milliseconds)
 */
export const CACHE_TTL = {
  BALANCE: 30000,        // 30 seconds
  ENCRYPTED_DATA: 60000, // 1 minute (encrypted data changes less frequently)
  CONTRACT_STATE: 45000, // 45 seconds
  USER_DATA: 30000,      // 30 seconds
} as const;
