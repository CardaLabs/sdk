import type { DataProvider } from '@/providers/base/provider.interface';
import { BlockfrostProvider } from '@/providers/blockfrost/index';
import { CoinGeckoProvider } from '@/providers/coingecko/index';
import type {
  AssetUnit,
  CardanoAddress,
  RequestOptions,
  TokenData,
  TokenDataField,
  WalletData,
  WalletDataField,
} from '@/types/common';
import { ConfigurationError, ValidationError } from '@/types/errors';
import type {
  CardalabsConfig,
  EventListener,
  ProviderHealth,
  SDKEvent,
  SDKMethodOptions,
  SDKResponse,
  SDKStats,
} from '@/types/sdk';

import {
  DataAggregator,
  type TokenDataAggregationRequest,
  type WalletDataAggregationRequest,
} from './aggregator/data-aggregator';
import { type CacheInterface, DefaultCacheKeyBuilder, MemoryCache } from './cache/index';

export class CardalabsSDK {
  private config: CardalabsConfig;
  private providers: Map<string, DataProvider> = new Map();
  private aggregator: DataAggregator;
  private cache: CacheInterface;
  private cacheKeyBuilder: DefaultCacheKeyBuilder;
  private initialized = false;
  private stats: SDKStats;
  private eventListeners: Map<SDKEvent, EventListener[]> = new Map();
  private healthCheckInterval?: ReturnType<typeof setInterval>;

  constructor(config: CardalabsConfig = {}) {
    this.config = {
      ...config,
      cache: {
        defaultTtl: 300, // 5 minutes default
        maxSize: 1000,
        autoCleanup: true,
        ...config.cache,
      },
      defaultRequestOptions: {
        timeout: 10000,
        maxRetries: 3,
        useCache: true,
        ...config.defaultRequestOptions,
      },
    };

    // Initialize cache
    this.cache = new MemoryCache(this.config.cache);
    this.cacheKeyBuilder = new DefaultCacheKeyBuilder();

    // Initialize aggregator (will be populated in initialize())
    this.aggregator = new DataAggregator();

    // Initialize stats
    this.stats = {
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        cached: 0,
      },
      providers: {},
      cache: {
        hits: 0,
        misses: 0,
        hitRate: 0,
        size: 0,
      },
      uptime: 0,
    };
  }

  /**
   * Initialize the SDK with configured providers
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new ConfigurationError('SDK already initialized');
    }

    const startTime = Date.now();

    try {
      // Initialize providers based on configuration
      await this.initializeProviders();

      // Initialize aggregator with providers
      const providerList = Array.from(this.providers.values());
      this.aggregator = new DataAggregator(providerList, this.config.providerPriorities ?? {});

      // Start health checks if enabled
      if (this.config.healthCheck?.enabled !== false) {
        this.startHealthChecks();
      }

      this.initialized = true;
      this.stats.uptime = Date.now();

      this.emit('sdk.initialized', {
        providers: Array.from(this.providers.keys()),
        initTime: Date.now() - startTime,
      });
    } catch (error) {
      throw new ConfigurationError(`Failed to initialize SDK: ${(error as Error).message}`, {
        originalError: error,
      });
    }
  }

  /**
   * Get token data with field selection and provider aggregation
   */
  async getTokenData(
    assetUnit: AssetUnit,
    fields: TokenDataField[] = ['price', 'marketCap', 'volume24h'],
    options?: SDKMethodOptions,
  ): Promise<SDKResponse<TokenData>> {
    this.ensureInitialized();

    const requestStart = Date.now();
    this.stats.requests.total++;

    try {
      // Check cache first
      if (options?.useCache !== false) {
        const cached = await this.getCachedTokenData(assetUnit, fields, options);
        if (cached) {
          this.stats.requests.cached++;
          this.stats.cache.hits++;
          return cached;
        }
        this.stats.cache.misses++;
      }

      // Create aggregation request
      const aggregationRequest: TokenDataAggregationRequest = {
        assetUnit,
        fields,
        options: {
          ...this.config.defaultRequestOptions,
          ...options,
        },
      };

      // Aggregate data from providers
      const result = await this.aggregator.aggregateTokenData(aggregationRequest);

      // Cache the result
      if (options?.useCache !== false && result.data) {
        await this.cacheTokenData(assetUnit, fields, result, options);
      }

      // Update stats
      if (result.errors && result.errors.length > 0) {
        this.stats.requests.failed++;
      } else {
        this.stats.requests.successful++;
      }

      this.updateProviderStats(result.metadata?.dataSources ?? []);

      this.emit('request.complete', {
        type: 'token',
        assetUnit,
        fields,
        responseTime: Date.now() - requestStart,
        cached: false,
      });

      return result;
    } catch (error) {
      this.stats.requests.failed++;

      this.emit('request.error', {
        type: 'token',
        assetUnit,
        error: (error as Error).message,
      });

      throw error;
    }
  }

  /**
   * Get wallet data with field selection and provider aggregation
   */
  async getWalletData(
    address: CardanoAddress,
    fields: WalletDataField[] = ['balance', 'portfolio'],
    options?: SDKMethodOptions,
  ): Promise<SDKResponse<WalletData>> {
    this.ensureInitialized();

    const requestStart = Date.now();
    this.stats.requests.total++;

    try {
      // Check cache first
      if (options?.useCache !== false) {
        const cached = await this.getCachedWalletData(address, fields, options);
        if (cached) {
          this.stats.requests.cached++;
          this.stats.cache.hits++;
          return cached;
        }
        this.stats.cache.misses++;
      }

      // Create aggregation request
      const aggregationRequest: WalletDataAggregationRequest = {
        address,
        fields,
        options: {
          ...this.config.defaultRequestOptions,
          ...options,
        },
      };

      // Aggregate data from providers
      const result = await this.aggregator.aggregateWalletData(aggregationRequest);

      // Cache the result
      if (options?.useCache !== false && result.data) {
        await this.cacheWalletData(address, fields, result, options);
      }

      // Update stats
      if (result.errors && result.errors.length > 0) {
        this.stats.requests.failed++;
      } else {
        this.stats.requests.successful++;
      }

      this.updateProviderStats(result.metadata?.dataSources ?? []);

      this.emit('request.complete', {
        type: 'wallet',
        address,
        fields,
        responseTime: Date.now() - requestStart,
        cached: false,
      });

      return result;
    } catch (error) {
      this.stats.requests.failed++;

      this.emit('request.error', {
        type: 'wallet',
        address,
        error: (error as Error).message,
      });

      throw error;
    }
  }

  /**
   * Get health status of all providers
   */
  async getProviderHealth(): Promise<Record<string, ProviderHealth>> {
    this.ensureInitialized();

    const healthChecks = Array.from(this.providers.entries()).map(
      async ([name, provider]): Promise<[string, ProviderHealth]> => {
        try {
          const health = await provider.healthCheck();
          return [name, health];
        } catch (error) {
          return [
            name,
            {
              provider: name,
              healthy: false,
              lastCheck: new Date(),
              consecutiveFailures: 1,
              lastError: (error as Error).message,
            },
          ];
        }
      },
    );

    const results = await Promise.all(healthChecks);
    return Object.fromEntries(results);
  }

  /**
   * Get SDK statistics
   */
  async getStats(): Promise<SDKStats> {
    const cacheStats = await this.cache.getStats();

    return {
      ...this.stats,
      cache: {
        hits: cacheStats.hits,
        misses: cacheStats.misses,
        hitRate: cacheStats.hitRate,
        size: cacheStats.size,
      },
      uptime: this.stats.uptime > 0 ? Date.now() - this.stats.uptime : 0,
    };
  }

  /**
   * Add event listener
   */
  addEventListener(event: SDKEvent, listener: EventListener): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(event: SDKEvent, listener: EventListener): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Clear all cached data
   */
  async clearCache(): Promise<void> {
    await this.cache.clear();
    this.emit('cache.cleared', {});
  }

  /**
   * Destroy the SDK and cleanup resources
   */
  async destroy(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Destroy all providers (handle errors gracefully)
    const destroyPromises = Array.from(this.providers.values()).map(async (provider) => {
      try {
        await provider.destroy();
      } catch (error) {
        // Log error but don't fail the entire destroy process
        console.warn(`Failed to destroy provider ${provider.name}:`, error);
      }
    });
    await Promise.all(destroyPromises);

    // Close cache
    try {
      await this.cache.close();
    } catch (error) {
      console.warn('Failed to close cache:', error);
    }

    this.initialized = false;
    this.emit('sdk.destroyed', {});
  }

  private async initializeProviders(): Promise<void> {
    const providersConfig = this.config.providers ?? {};

    // Initialize Blockfrost if configured
    if (providersConfig.blockfrost?.enabled !== false && providersConfig.blockfrost?.projectId) {
      const provider = new BlockfrostProvider();
      await provider.initialize(providersConfig.blockfrost as unknown as Record<string, unknown>);
      this.providers.set('blockfrost', provider);
    }

    // Initialize CoinGecko if configured (API key is required)
    if (providersConfig.coingecko?.enabled !== false) {
      const provider = new CoinGeckoProvider();
      await provider.initialize(
        (providersConfig.coingecko || {}) as unknown as Record<string, unknown>,
      );
      this.providers.set('coingecko', provider);
    }

    // TODO: Add other providers as they are implemented

    if (this.providers.size === 0) {
      throw new ConfigurationError('No providers configured or enabled');
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new ConfigurationError('SDK not initialized. Call initialize() first.');
    }
  }

  private async getCachedTokenData(
    assetUnit: AssetUnit,
    fields: TokenDataField[],
    options?: SDKMethodOptions,
  ): Promise<SDKResponse<TokenData> | null> {
    const cacheKey = this.cacheKeyBuilder.buildTokenDataKey(assetUnit, fields);
    return await this.cache.get<SDKResponse<TokenData>>(cacheKey);
  }

  private async getCachedWalletData(
    address: CardanoAddress,
    fields: WalletDataField[],
    options?: SDKMethodOptions,
  ): Promise<SDKResponse<WalletData> | null> {
    const cacheKey = this.cacheKeyBuilder.buildWalletDataKey(address, fields);
    return await this.cache.get<SDKResponse<WalletData>>(cacheKey);
  }

  private async cacheTokenData(
    assetUnit: AssetUnit,
    fields: TokenDataField[],
    result: SDKResponse<TokenData>,
    options?: SDKMethodOptions,
  ): Promise<void> {
    const cacheKey = this.cacheKeyBuilder.buildTokenDataKey(assetUnit, fields);
    const ttl = options?.cacheTimeout ?? this.config.cache?.defaultTtl ?? 300;
    await this.cache.set(cacheKey, result, ttl);
  }

  private async cacheWalletData(
    address: CardanoAddress,
    fields: WalletDataField[],
    result: SDKResponse<WalletData>,
    options?: SDKMethodOptions,
  ): Promise<void> {
    const cacheKey = this.cacheKeyBuilder.buildWalletDataKey(address, fields);
    const ttl = options?.cacheTimeout ?? this.config.cache?.defaultTtl ?? 300;
    await this.cache.set(cacheKey, result, ttl);
  }

  private updateProviderStats(dataSources: string[]): void {
    for (const provider of dataSources) {
      if (!this.stats.providers[provider]) {
        this.stats.providers[provider] = {
          requests: 0,
          successes: 0,
          failures: 0,
          avgResponseTime: 0,
          lastUsed: new Date(),
        };
      }

      this.stats.providers[provider].requests++;
      this.stats.providers[provider].successes++;
      this.stats.providers[provider].lastUsed = new Date();
    }
  }

  private startHealthChecks(): void {
    const interval = this.config.healthCheck?.interval ?? 300; // 5 minutes default

    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.getProviderHealth();
        this.emit('health.check.complete', health);
      } catch (error) {
        this.emit('health.check.error', { error: (error as Error).message });
      }
    }, interval * 1000);

    // Ensure the interval doesn't keep the process alive
    this.healthCheckInterval.unref();
  }

  private emit(event: SDKEvent, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event, data);
        } catch (error) {
          // Silently ignore listener errors
          console.warn('Event listener error:', error);
        }
      }
    }
  }
}
