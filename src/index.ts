import { CardalabsSDK } from './sdk/cardalabs';

// Main SDK export
export { CardalabsSDK as CardalabsSDK } from './sdk/cardalabs';

// Type exports
export type {
  // Common data types
  TokenData,
  WalletData,
  PortfolioData,
  PortfolioAsset,
  PortfolioNft,
  LiquidityPosition,
  TransactionData,
  TransactionAsset,
  StakingData,
  StakingPool,
  RequestOptions,
  AssetUnit,
  CardanoAddress,
  TokenDataField,
  WalletDataField,
  TransactionType,
  TransactionStatus,
} from './types/common';

export type {
  // SDK configuration
  CardalabsConfig,
  BlockfrostConfig,
  CoingeckoConfig,
  TaptoolsConfig,
  DexscreenerConfig,
  CoinmarketcapConfig,
  DexhunterConfig,
  LivecoinwatchConfig,
  SnekdotfunConfig,
  CacheConfig,
  CacheInterface,
  ProviderCapabilities,
  ProviderHealth,
  SDKResponse,
  SDKMethodOptions,
  ResponseMetadata,
  SDKStats,
  SDKEvent,
  EventListener,
} from './types/sdk';

export type {
  // Provider types
  ProviderResponse,
} from './types/providers';

export type {
  // Error types
  CardalabsError,
  NetworkError,
  ValidationError,
  ConfigurationError,
  RateLimitError,
  TimeoutError,
  ProviderError,
  ErrorHandlerConfig,
} from './types/errors';

// Provider exports (for advanced usage)
export type { DataProvider } from './providers/base/provider.interface';
export { BaseProvider } from './providers/base/provider.interface';
export { BlockfrostProvider } from './providers/blockfrost/index';
export { CoinGeckoProvider } from './providers/coingecko/index';

// Cache exports (for custom implementations)
export { MemoryCache, DefaultCacheKeyBuilder, SimpleCacheKeyBuilder } from './sdk/cache/index';

export type {
  CacheEntry,
  CacheStats,
  CacheOptions,
  CacheKeyBuilder,
  CacheKeyMetadata,
  CacheEvent,
  CacheEventListener,
  CacheManager,
} from './sdk/cache/index';

// Aggregator exports (for advanced usage)
export { FieldRouter, DataAggregator } from './sdk/aggregator/index';

export type {
  FieldRoute,
  RoutingStrategy,
  ProviderMetrics,
  RoutingPlan,
  AggregationStrategy,
  TokenDataAggregationRequest,
  WalletDataAggregationRequest,
} from './sdk/aggregator/index';

// Utility exports
export { HTTPClient } from './utils/http-client';
export { validateAssetUnit, validateCardanoAddress } from './utils/validation';

export default CardalabsSDK;
