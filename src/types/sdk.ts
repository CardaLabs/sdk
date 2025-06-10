import type { RequestOptions, TokenDataField, WalletDataField } from './common';
import type { ErrorHandlerConfig } from './errors';

export interface CardalabsConfig {
  // Provider configurations
  providers?: {
    blockfrost?: BlockfrostConfig;
    coingecko?: CoingeckoConfig;
    taptools?: TaptoolsConfig;
    dexscreener?: DexscreenerConfig;
    coinmarketcap?: CoinmarketcapConfig;
    dexhunter?: DexhunterConfig;
    livecoinwatch?: LivecoinwatchConfig;
    snekdotfun?: SnekdotfunConfig;
  };

  // Global configuration
  cache?: CacheConfig;
  errorHandling?: ErrorHandlerConfig;
  defaultRequestOptions?: RequestOptions;

  // Provider management
  providerPriorities?: ProviderPriorities;
  healthCheck?: HealthCheckConfig;
}

/**
 * Provider-specific configurations
 */
export interface BlockfrostConfig {
  projectId: string;
  baseUrl?: string;
  enabled?: boolean;
}

export interface CoingeckoConfig {
  apiKey: string;
  baseUrl?: string;
  enabled?: boolean;
  pro?: boolean; // Whether using CoinGecko Pro API
}

export interface TaptoolsConfig {
  apiKey: string;
  baseUrl?: string;
  enabled?: boolean;
}

export interface DexscreenerConfig {
  baseUrl?: string;
  enabled?: boolean;
}

export interface CoinmarketcapConfig {
  apiKey: string;
  baseUrl?: string;
  enabled?: boolean;
}

export interface DexhunterConfig {
  baseUrl?: string;
  enabled?: boolean;
}

export interface LivecoinwatchConfig {
  apiKey: string;
  baseUrl?: string;
  enabled?: boolean;
}

export interface SnekdotfunConfig {
  baseUrl?: string;
  enabled?: boolean;
}

/**
 * Caching configuration
 */
export interface CacheConfig {
  // Cache implementation type
  type?: 'memory' | 'redis' | 'file' | 'custom';

  // Default TTL in seconds
  defaultTtl?: number;

  // Field-specific TTLs
  fieldTtl?: Partial<Record<TokenDataField | WalletDataField, number>>;

  // Maximum cache size (for memory cache)
  maxSize?: number;

  // Whether to enable automatic cleanup of expired entries
  autoCleanup?: boolean;

  // Whether to enable cache compression
  compression?: boolean;

  // Custom cache implementation
  customCache?: CacheInterface;

  // Redis configuration (if using Redis cache)
  redis?: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };

  // File cache configuration
  file?: {
    directory: string;
    maxFiles?: number;
  };
}

/**
 * Cache interface for custom implementations
 */
export interface CacheInterface {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
}

/**
 * Provider priority configuration
 */
export interface ProviderPriorities {
  // Default provider order for each data field
  [field: string]: string[];
}

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  // Whether to enable health checks
  enabled?: boolean;

  // Interval between health checks (in seconds)
  interval?: number;

  // Timeout for health check requests (in milliseconds)
  timeout?: number;

  // Number of consecutive failures before marking provider as unhealthy
  failureThreshold?: number;

  // Number of consecutive successes before marking provider as healthy
  successThreshold?: number;
}

/**
 * Provider health status
 */
export interface ProviderHealth {
  provider: string;
  healthy: boolean;
  lastCheck: Date;
  consecutiveFailures: number;
  lastError?: string;
  responseTime?: number;
}

/**
 * SDK method options that extend base request options
 */
export interface SDKMethodOptions extends RequestOptions {
  // Whether to aggregate data from multiple providers
  aggregate?: boolean;

  // Fields to include in the response
  fields?: string[];

  // Whether to include metadata about data sources
  includeMetadata?: boolean;
}

/**
 * Response metadata
 */
export interface ResponseMetadata {
  // Which providers were used
  dataSources: string[];

  // Cache hit/miss status
  cacheStatus: 'hit' | 'miss' | 'partial';

  // Response time
  responseTime: number;

  // Timestamp of the response
  timestamp: Date;

  // Provider health at time of request
  providerHealth?: Record<string, boolean>;
}

/**
 * SDK response wrapper
 */
export interface SDKResponse<T> {
  data: T;
  metadata?: ResponseMetadata;
  errors?: Array<{
    provider: string;
    error: string;
    recoverable: boolean;
  }>;
}

/**
 * Provider capability declaration
 */
export interface ProviderCapabilities {
  // Fields this provider can supply
  tokenData?: TokenDataField[];
  walletData?: WalletDataField[];

  // Rate limits
  rateLimit?: {
    requestsPerSecond?: number;
    requestsPerMinute?: number;
    requestsPerHour?: number;
    requestsPerDay?: number;
  };

  // Features supported
  features?: {
    batch?: boolean; // Supports batch requests
    realtime?: boolean; // Supports real-time data
    historical?: boolean; // Supports historical data
  };

  // Cost information (if applicable)
  cost?: {
    free?: boolean;
    paidTiers?: string[];
  };
}

/**
 * Provider registration interface
 */
export interface ProviderRegistration {
  name: string;
  capabilities: ProviderCapabilities;
  priority: number;
  healthCheckEndpoint?: string;
}

/**
 * SDK events
 */
export type SDKEvent =
  | 'provider.healthy'
  | 'provider.unhealthy'
  | 'cache.hit'
  | 'cache.miss'
  | 'cache.cleared'
  | 'request.start'
  | 'request.complete'
  | 'request.error'
  | 'aggregation.start'
  | 'aggregation.complete'
  | 'sdk.initialized'
  | 'sdk.destroyed'
  | 'health.check.complete'
  | 'health.check.error';

/**
 * Event listener interface
 */
export interface EventListener {
  (event: SDKEvent, data: unknown): void;
}

/**
 * SDK statistics
 */
export interface SDKStats {
  requests: {
    total: number;
    successful: number;
    failed: number;
    cached: number;
  };

  providers: Record<
    string,
    {
      requests: number;
      successes: number;
      failures: number;
      avgResponseTime: number;
      lastUsed: Date;
    }
  >;

  cache: {
    hits: number;
    misses: number;
    hitRate: number;
    size: number;
  };

  uptime: number; // in milliseconds
}
