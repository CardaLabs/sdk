# CardaLabs SDK API Reference

## Table of Contents

- [CardalabsSDK Class](#CardalabsSDK-class)
- [Configuration Types](#configuration-types)
- [Data Types](#data-types)
- [Provider Types](#provider-types)
- [Error Types](#error-types)
- [Utility Functions](#utility-functions)

## CardalabsSDK Class

### Constructor

```typescript
constructor(config?: CardalabsConfig)
```

Creates a new CardalabsSDK instance with the provided configuration.

**Parameters:**

- `config?: CardalabsConfig` - SDK configuration object

**Example:**

```typescript
const sdk = new CardalabsSDK({
  providers: {
    blockfrost: { projectId: 'your-project-id' },
    coingecko: { apiKey: 'your-api-key' },
  },
});
```

### Methods

#### initialize()

```typescript
async initialize(): Promise<void>
```

Initializes the SDK with configured providers. Must be called before using data methods.

**Throws:**

- `ConfigurationError` - If SDK is already initialized or configuration is invalid

**Example:**

```typescript
await sdk.initialize();
```

#### getTokenData()

```typescript
async getTokenData(
  assetUnit: AssetUnit,
  fields?: TokenDataField[],
  options?: SDKMethodOptions
): Promise<SDKResponse<TokenData>>
```

Retrieves token data for a specified asset.

**Parameters:**

- `assetUnit: AssetUnit` - Asset identifier (policy ID + asset name or 'lovelace' for ADA)
- `fields?: TokenDataField[]` - Array of data fields to retrieve (default: `['price', 'marketCap', 'volume24h']`)
- `options?: SDKMethodOptions` - Request options

**Returns:** `Promise<SDKResponse<TokenData>>`

**Example:**

```typescript
const response = await sdk.getTokenData('lovelace', ['price', 'marketCap', 'name', 'symbol'], {
  useCache: true,
  timeout: 5000,
  preferredProviders: ['coingecko'],
});

console.log(response.data.price); // Current price
console.log(response.data.marketCap); // Market capitalization
console.log(response.metadata.dataSources); // ['coingecko']
```

#### getWalletData()

```typescript
async getWalletData(
  address: CardanoAddress,
  fields?: WalletDataField[],
  options?: SDKMethodOptions
): Promise<SDKResponse<WalletData>>
```

Retrieves wallet data for a specified Cardano address.

**Parameters:**

- `address: CardanoAddress` - Cardano wallet address (bech32 format)
- `fields?: WalletDataField[]` - Array of data fields to retrieve (default: `['balance', 'portfolio']`)
- `options?: SDKMethodOptions` - Request options

**Returns:** `Promise<SDKResponse<WalletData>>`

**Example:**

```typescript
const response = await sdk.getWalletData(
  'addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3n0d3vllmyqwsx5wktcd8cc3sq835lu7drv2xwl2wywfgse35a3x',
  ['balance', 'portfolio', 'transactions'],
);

console.log(response.data.balance?.lovelace); // ADA balance in lovelace
console.log(response.data.portfolio?.totalValue); // Total portfolio value
```

#### getProviderHealth()

```typescript
async getProviderHealth(): Promise<Record<string, ProviderHealth>>
```

Gets the health status of all configured providers.

**Returns:** `Promise<Record<string, ProviderHealth>>`

**Example:**

```typescript
const health = await sdk.getProviderHealth();

console.log(health.blockfrost.healthy); // true/false
console.log(health.blockfrost.responseTime); // 150ms
console.log(health.coingecko.lastError); // Error message if unhealthy
```

#### getStats()

```typescript
async getStats(): Promise<SDKStats>
```

Gets SDK usage statistics including request counts, cache performance, and provider metrics.

**Returns:** `Promise<SDKStats>`

**Example:**

```typescript
const stats = await sdk.getStats();

console.log(stats.requests.total); // Total requests made
console.log(stats.cache.hitRate); // Cache hit rate (0-1)
console.log(stats.providers.coingecko.avgResponseTime); // Average response time
```

#### addEventListener()

```typescript
addEventListener(event: SDKEvent, listener: EventListener): void
```

Adds an event listener for SDK events.

**Parameters:**

- `event: SDKEvent` - Event type to listen for
- `listener: EventListener` - Function to call when event occurs

**Example:**

```typescript
sdk.addEventListener('request.complete', (event, data) => {
  console.log(`Request completed in ${data.responseTime}ms`);
});

sdk.addEventListener('provider.unhealthy', (event, data) => {
  console.warn(`Provider ${data.provider} is unhealthy: ${data.error}`);
});
```

#### removeEventListener()

```typescript
removeEventListener(event: SDKEvent, listener: EventListener): void
```

Removes an event listener.

**Parameters:**

- `event: SDKEvent` - Event type
- `listener: EventListener` - Listener function to remove

#### clearCache()

```typescript
async clearCache(): Promise<void>
```

Clears all cached data.

**Example:**

```typescript
await sdk.clearCache();
```

#### destroy()

```typescript
async destroy(): Promise<void>
```

Destroys the SDK instance and cleans up all resources.

**Example:**

```typescript
await sdk.destroy();
```

## Configuration Types

### CardalabsConfig

```typescript
interface CardalabsConfig {
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

  cache?: CacheConfig;
  errorHandling?: ErrorHandlerConfig;
  defaultRequestOptions?: RequestOptions;
  providerPriorities?: ProviderPriorities;
  healthCheck?: HealthCheckConfig;
}
```

### Provider Configurations

#### BlockfrostConfig

```typescript
interface BlockfrostConfig {
  projectId: string;
  baseUrl?: string;
  enabled?: boolean;
}
```

#### CoingeckoConfig

```typescript
interface CoingeckoConfig {
  apiKey: string;
  baseUrl?: string;
  enabled?: boolean;
  pro?: boolean; // Whether using CoinGecko Pro API
}
```

#### TaptoolsConfig

```typescript
interface TaptoolsConfig {
  apiKey: string;
  baseUrl?: string;
  enabled?: boolean;
}
```

#### DexscreenerConfig

```typescript
interface DexscreenerConfig {
  baseUrl?: string;
  enabled?: boolean;
}
```

### CacheConfig

```typescript
interface CacheConfig {
  type?: 'memory' | 'redis' | 'file' | 'custom';
  defaultTtl?: number;
  fieldTtl?: Partial<Record<TokenDataField | WalletDataField, number>>;
  maxSize?: number;
  compression?: boolean;
  customCache?: CacheInterface;

  // Redis configuration
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
```

### SDKMethodOptions

```typescript
interface SDKMethodOptions extends RequestOptions {
  aggregate?: boolean;
  fields?: string[];
  includeMetadata?: boolean;
}
```

### RequestOptions

```typescript
interface RequestOptions {
  preferredProviders?: string[];
  fallbackProviders?: string[];
  useCache?: boolean;
  cacheTimeout?: number;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}
```

## Data Types

### TokenData

```typescript
interface TokenData {
  // Price and market data
  price?: number;
  priceUsd?: number;
  marketCap?: number;
  marketCapUsd?: number;
  volume24h?: number;
  volume24hUsd?: number;

  // Price changes
  priceChange24h?: number;
  priceChangePercentage24h?: number;
  priceChange7d?: number;
  priceChangePercentage7d?: number;
  priceChange30d?: number;
  priceChangePercentage30d?: number;

  // Supply and holders
  totalSupply?: number;
  circulatingSupply?: number;
  maxSupply?: number;
  holders?: number;

  // Token metadata
  name?: string;
  symbol?: string;
  decimals?: number;
  description?: string;
  logo?: string;

  // Trading data
  high24h?: number;
  low24h?: number;
  ath?: number; // All-time high
  atl?: number; // All-time low
  athDate?: Date;
  atlDate?: Date;

  // DEX specific
  liquidity?: number;
  liquidityUsd?: number;

  // Metadata
  lastUpdated?: Date;
  dataSource?: string[];
}
```

### WalletData

```typescript
interface WalletData {
  // Basic balance information
  balance?: { [assetUnit: string]: number };
  balanceUsd?: number;

  // Portfolio data
  portfolio?: PortfolioData;

  // Transaction history
  transactions?: TransactionData[];

  // Staking information
  staking?: StakingData;

  // Metadata
  lastUpdated?: Date;
  dataSource?: string[];
}
```

### PortfolioData

```typescript
interface PortfolioData {
  // Total portfolio value
  totalValue?: number;
  totalValueUsd?: number;

  // Asset breakdown
  assets?: PortfolioAsset[];

  // NFT holdings
  nfts?: PortfolioNft[];

  // Liquidity pool positions
  liquidityPositions?: LiquidityPosition[];

  // Performance metrics
  performance24h?: number;
  performance7d?: number;
  performance30d?: number;

  // Risk metrics
  diversificationScore?: number;
}
```

### PortfolioAsset

```typescript
interface PortfolioAsset {
  assetUnit: string;
  name?: string;
  symbol?: string;
  balance: number;
  value?: number;
  valueUsd?: number;
  percentage?: number;

  // Performance
  change24h?: number;
  changePercentage24h?: number;
}
```

### TransactionData

```typescript
interface TransactionData {
  hash: string;
  blockHeight?: number;
  timestamp: Date;
  type: TransactionType;
  amount?: number;
  amountUsd?: number;
  fee?: number;
  feeUsd?: number;
  status: TransactionStatus;

  // Addresses involved
  fromAddress?: string;
  toAddress?: string;

  // Assets involved
  assets?: TransactionAsset[];
}
```

### TransactionAsset

```typescript
interface TransactionAsset {
  assetUnit: string;
  amount: number;
  direction: 'in' | 'out';
}
```

### StakingData

```typescript
interface StakingData {
  totalStaked?: number;
  totalStakedUsd?: number;
  rewards?: number;
  rewardsUsd?: number;

  // Staking pools
  pools?: StakingPool[];
}
```

### StakingPool

```typescript
interface StakingPool {
  poolId: string;
  poolName?: string;
  stakedAmount: number;
  rewards: number;
  apy?: number;
}
```

### SDKResponse

```typescript
interface SDKResponse<T> {
  data: T;
  metadata?: ResponseMetadata;
  errors?: Array<{
    provider: string;
    error: string;
    recoverable: boolean;
  }>;
}
```

### ResponseMetadata

```typescript
interface ResponseMetadata {
  dataSources: string[];
  cacheStatus: 'hit' | 'miss' | 'partial';
  responseTime: number;
  timestamp: Date;
  providerHealth?: Record<string, boolean>;
}
```

## Provider Types

### ProviderHealth

```typescript
interface ProviderHealth {
  provider: string;
  healthy: boolean;
  lastCheck: Date;
  consecutiveFailures: number;
  lastError?: string;
  responseTime?: number;
}
```

### ProviderCapabilities

```typescript
interface ProviderCapabilities {
  tokenData?: TokenDataField[];
  walletData?: WalletDataField[];

  rateLimit?: {
    requestsPerSecond?: number;
    requestsPerMinute?: number;
    requestsPerHour?: number;
    requestsPerDay?: number;
  };

  features?: {
    batch?: boolean;
    realtime?: boolean;
    historical?: boolean;
  };

  cost?: {
    free?: boolean;
    paidTiers?: string[];
  };
}
```

### ProviderResponse

```typescript
interface ProviderResponse<T> {
  success: boolean;
  data?: T;
  error?: Error;
  provider: string;
  timestamp: Date;
  metadata?: ProviderResponseMetadata;
}
```

## Error Types

### CardalabsError

```typescript
abstract class CardalabsError extends Error {
  readonly code: string;
  readonly context?: Record<string, unknown>;
  readonly recoverable: boolean;
}
```

### NetworkError

```typescript
class NetworkError extends CardalabsError {
  constructor(message: string, statusCode?: number, context?: Record<string, unknown>);
}
```

### ValidationError

```typescript
class ValidationError extends CardalabsError {
  constructor(message: string, field?: string, context?: Record<string, unknown>);
}
```

### ConfigurationError

```typescript
class ConfigurationError extends CardalabsError {
  constructor(message: string, context?: Record<string, unknown>);
}
```

### RateLimitError

```typescript
class RateLimitError extends CardalabsError {
  constructor(message: string, retryAfter?: number, context?: Record<string, unknown>);
}
```

### TimeoutError

```typescript
class TimeoutError extends CardalabsError {
  constructor(message: string, timeout: number, context?: Record<string, unknown>);
}
```

## Utility Functions

### validateAssetUnit()

```typescript
function validateAssetUnit(assetUnit: string): boolean;
```

Validates a Cardano asset unit format.

**Parameters:**

- `assetUnit: string` - Asset unit to validate

**Returns:** `boolean`

**Example:**

```typescript
const isValid = validateAssetUnit('lovelace'); // true
const isValid2 = validateAssetUnit('policy123.asset456'); // true
const isValid3 = validateAssetUnit('invalid'); // false
```

### validateCardanoAddress()

```typescript
function validateCardanoAddress(address: string): boolean;
```

Validates a Cardano address format.

**Parameters:**

- `address: string` - Address to validate

**Returns:** `boolean`

**Example:**

```typescript
const isValid = validateCardanoAddress(
  'addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3n0d3vllmyqwsx5wktcd8cc3sq835lu7drv2xwl2wywfgse35a3x',
); // true
```

## Type Aliases

### TokenDataField

```typescript
type TokenDataField = keyof TokenData;
```

Available fields: `'price'`, `'priceUsd'`, `'marketCap'`, `'marketCapUsd'`, `'volume24h'`, `'volume24hUsd'`, `'priceChange24h'`, `'priceChangePercentage24h'`, `'priceChange7d'`, `'priceChangePercentage7d'`, `'priceChange30d'`, `'priceChangePercentage30d'`, `'totalSupply'`, `'circulatingSupply'`, `'maxSupply'`, `'holders'`, `'name'`, `'symbol'`, `'decimals'`, `'description'`, `'logo'`, `'high24h'`, `'low24h'`, `'ath'`, `'atl'`, `'athDate'`, `'atlDate'`, `'liquidity'`, `'liquidityUsd'`, `'lastUpdated'`, `'dataSource'`

### WalletDataField

```typescript
type WalletDataField = keyof WalletData;
```

Available fields: `'balance'`, `'balanceUsd'`, `'portfolio'`, `'transactions'`, `'staking'`, `'lastUpdated'`, `'dataSource'`

### AssetUnit

```typescript
type AssetUnit = string;
```

Asset unit identifier. Can be:

- `'lovelace'` for ADA
- `'policyId.assetNameHex'` for native assets
- Policy ID + asset name in hexadecimal format

### CardanoAddress

```typescript
type CardanoAddress = string;
```

Cardano address in bech32 format starting with 'addr'.

### TransactionType

```typescript
type TransactionType =
  | 'send'
  | 'receive'
  | 'swap'
  | 'stake'
  | 'unstake'
  | 'reward'
  | 'mint'
  | 'burn'
  | 'contract_interaction';
```

### TransactionStatus

```typescript
type TransactionStatus = 'confirmed' | 'pending' | 'failed';
```

### SDKEvent

```typescript
type SDKEvent =
  | 'provider.healthy'
  | 'provider.unhealthy'
  | 'cache.hit'
  | 'cache.miss'
  | 'request.start'
  | 'request.complete'
  | 'request.error'
  | 'aggregation.start'
  | 'aggregation.complete';
```

## Constants

### Default Field Selections

```typescript
const DEFAULT_TOKEN_FIELDS: TokenDataField[] = ['price', 'marketCap', 'volume24h'];
const DEFAULT_WALLET_FIELDS: WalletDataField[] = ['balance', 'portfolio'];
```

### Default Cache TTL Values (seconds)

```typescript
const DEFAULT_CACHE_TTL = {
  price: 30,
  marketCap: 60,
  volume24h: 60,
  balance: 120,
  name: 600,
  symbol: 600,
  decimals: 3600,
  description: 3600,
};
```