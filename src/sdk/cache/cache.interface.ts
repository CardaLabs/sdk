/**
 * Cache interface and related types
 */
import type { TokenDataField, WalletDataField } from '@/types/common';

/**
 * Base cache interface that all cache implementations must follow
 */
export interface CacheInterface {
  /**
   * Get a value from cache
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Set a value in cache with optional TTL
   */
  set<T>(key: string, value: T, ttl?: number): Promise<void>;

  /**
   * Delete a value from cache
   */
  delete(key: string): Promise<boolean>;

  /**
   * Clear all cached values
   */
  clear(): Promise<void>;

  /**
   * Check if a key exists in cache
   */
  has(key: string): Promise<boolean>;

  /**
   * Get cache statistics
   */
  getStats(): Promise<CacheStats>;

  /**
   * Close/cleanup cache resources
   */
  close(): Promise<void>;
}

/**
 * Cache statistics interface
 */
export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  maxSize?: number;
  memoryUsage?: number; // in bytes
}

/**
 * Cache entry metadata
 */
export interface CacheEntry<T> {
  value: T;
  ttl: number; // Time to live in milliseconds
  createdAt: number; // Timestamp when entry was created
  expiresAt: number; // Timestamp when entry expires
  accessCount: number; // Number of times accessed
  lastAccessed: number; // Last access timestamp
}

/**
 * Cache configuration options
 */
export interface CacheOptions {
  // Default TTL for cache entries (in seconds)
  defaultTtl?: number;

  // Maximum number of entries
  maxSize?: number;

  // Field-specific TTL configuration
  fieldTtl?: Partial<Record<TokenDataField | WalletDataField, number>>;

  // Whether to enable cache statistics
  enableStats?: boolean;

  // Cache cleanup interval (in milliseconds)
  cleanupInterval?: number;

  // Whether to automatically remove expired entries
  autoCleanup?: boolean;
}

/**
 * Cache key builder interface
 */
export interface CacheKeyBuilder {
  /**
   * Build cache key for token data request
   */
  buildTokenDataKey(assetUnit: string, fields?: string[], provider?: string): string;

  /**
   * Build cache key for wallet data request
   */
  buildWalletDataKey(address: string, fields?: string[], provider?: string): string;

  /**
   * Build cache key for aggregated data
   */
  buildAggregatedKey(
    type: 'token' | 'wallet',
    identifier: string,
    fields?: string[],
    providers?: string[],
  ): string;

  /**
   * Parse cache key to extract metadata
   */
  parseKey(key: string): CacheKeyMetadata | null;
}

/**
 * Metadata extracted from cache keys
 */
export interface CacheKeyMetadata {
  type: 'token' | 'wallet' | 'aggregated';
  identifier: string; // Asset unit or wallet address
  fields?: string[];
  provider?: string;
  providers?: string[];
}

/**
 * Cache event types
 */
export type CacheEvent = 'hit' | 'miss' | 'set' | 'delete' | 'clear' | 'expired' | 'evicted';

/**
 * Cache event listener
 */
export interface CacheEventListener {
  (event: CacheEvent, key: string, metadata?: CacheKeyMetadata): void;
}

/**
 * Cache manager interface for coordinating multiple cache instances
 */
export interface CacheManager {
  /**
   * Get the appropriate cache instance for a given key
   */
  getCache(key: string): CacheInterface;

  /**
   * Register a cache instance
   */
  registerCache(name: string, cache: CacheInterface): void;

  /**
   * Unregister a cache instance
   */
  unregisterCache(name: string): void;

  /**
   * Get all cache names
   */
  getCacheNames(): string[];

  /**
   * Get combined statistics from all caches
   */
  getGlobalStats(): Promise<CacheStats>;

  /**
   * Clear all caches
   */
  clearAll(): Promise<void>;

  /**
   * Close all cache instances
   */
  closeAll(): Promise<void>;
}
