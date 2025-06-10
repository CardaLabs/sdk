# 🚀 Cardalabs SDK

**The LLM Toolkit for the Cardano Ecosystem** - A TypeScript SDK that provides unified access to multiple Cardano data providers through a single interface.

## Installation

```bash
npm install @cardalabs/sdk
```

## Quick Start

```typescript
import { CardalabsSDK } from '@cardalabs/sdk';

// Initialize SDK with provider configurations
const sdk = new CardalabsSDK({
  providers: {
    blockfrost: {
      projectId: 'your-blockfrost-project-id',
    },
    coingecko: {
      apiKey: 'your-coingecko-api-key',
    },
  },
});

// Initialize the SDK
await sdk.initialize();

// Get token data (price from CoinGecko, metadata from Blockfrost)
const tokenData = await sdk.getTokenData(
  'lovelace', // ADA
  ['price', 'marketCap', 'name', 'symbol'],
);

console.log(`ADA Price: $${tokenData.data.price}`);
console.log(`Market Cap: $${tokenData.data.marketCap}`);

// Get wallet data
const walletData = await sdk.getWalletData(
  'addr1...', // Cardano address
  ['balance', 'portfolio'],
);

console.log(`ADA Balance: ${walletData.data.balance?.lovelace} lovelace`);
```

## Configuration

### Basic Configuration

```typescript
import { type CardalabsConfig, CardalabsSDK } from '@cardalabs/sdk';

const config: CardalabsConfig = {
  // Provider configurations
  providers: {
    blockfrost: {
      projectId: process.env.BLOCKFROST_PROJECT_ID!,
      baseUrl: 'https://cardano-mainnet.blockfrost.io/api/v0',
      enabled: true,
    },
    coingecko: {
      apiKey: process.env.COINGECKO_API_KEY!,
      pro: true, // Use CoinGecko Pro API
      enabled: true,
    },
  },

  // Cache configuration
  cache: {
    defaultTtl: 300, // 5 minutes
    maxSize: 1000,
    fieldTtl: {
      // Field-specific cache durations
      price: 30, // 30 seconds for prices
      marketCap: 60, // 1 minute for market cap
      name: 600, // 10 minutes for metadata
      symbol: 600,
      balance: 120, // 2 minutes for balances
    },
  },

  // Provider priorities for each field
  providerPriorities: {
    price: ['coingecko', 'dexscreener'],
    marketCap: ['coingecko'],
    name: ['blockfrost', 'coingecko'],
    balance: ['blockfrost'],
    portfolio: ['taptools', 'blockfrost'],
  },

  // Health check configuration
  healthCheck: {
    enabled: true,
    interval: 300, // Check every 5 minutes
    timeout: 10000, // 10 second timeout
  },

  // Default request options
  defaultRequestOptions: {
    timeout: 10000,
    maxRetries: 3,
    useCache: true,
  },
};

const sdk = new CardalabsSDK(config);
```

### Environment Variables

Create a `.env` file:

```env
BLOCKFROST_PROJECT_ID=your_blockfrost_project_id
COINGECKO_API_KEY=your_coingecko_api_key
TAPTOOLS_API_KEY=your_taptools_api_key
```

## Core Concepts

### 1. **Data Fields**

The SDK uses a field-based approach where you specify exactly what data you need:

```typescript
// Token data fields
type TokenDataField =
  | 'price'
  | 'priceUsd'
  | 'marketCap'
  | 'volume24h'
  | 'priceChange24h'
  | 'name'
  | 'symbol'
  | 'decimals'
  | 'totalSupply'
  | 'holders'
  | 'liquidity';
// ... and more

// Wallet data fields
type WalletDataField = 'balance' | 'portfolio' | 'transactions' | 'staking';
// ... and more
```

### 2. **Provider Routing**

The SDK automatically determines which provider to use for each field:

```typescript
// This request will:
// - Get price from CoinGecko (best for market data)
// - Get name/symbol from Blockfrost (authoritative on-chain data)
// - Get balance from Blockfrost (only provider with wallet data)
const data = await sdk.getTokenData('asset_id', [
  'price', // → CoinGecko
  'name', // → Blockfrost
  'symbol', // → Blockfrost
  'balance', // → Blockfrost
]);
```

### 3. **Data Aggregation**

When multiple providers can supply the same field, the SDK aggregates intelligently:

```typescript
// Multiple providers might return price data
// SDK will use priority order, fallbacks, and conflict resolution
const tokenData = await sdk.getTokenData('asset_id', ['price'], {
  preferredProviders: ['coingecko'],
  fallbackProviders: ['dexscreener', 'coinmarketcap'],
});
```

### 4. **Caching Strategy**

Different data types have different cache durations:

- **Prices**: 30 seconds (frequently changing)
- **Market Cap/Volume**: 1 minute
- **Metadata**: 10 minutes (rarely changes)
- **Balances**: 2 minutes
- **Transaction History**: 5 minutes

## API Reference

### CardalabsSDK Class

#### Constructor

```typescript
constructor(config: CardalabsConfig = {})
```

#### Methods

##### `initialize(): Promise<void>`

Initializes the SDK with configured providers.

```typescript
await sdk.initialize();
```

##### `getTokenData(assetUnit, fields, options): Promise<SDKResponse<TokenData>>`

Gets token data for a specific asset.

**Parameters:**

- `assetUnit: AssetUnit` - Asset identifier (policy ID + asset name or 'lovelace' for ADA)
- `fields: TokenDataField[]` - Array of fields to retrieve
- `options?: SDKMethodOptions` - Request options

**Returns:** `Promise<SDKResponse<TokenData>>`

```typescript
const response = await sdk.getTokenData('lovelace', ['price', 'marketCap', 'volume24h'], {
  useCache: true,
  timeout: 5000,
  preferredProviders: ['coingecko'],
});

console.log(response.data.price);
console.log(response.metadata.dataSources); // ['coingecko']
console.log(response.metadata.responseTime); // 245ms
```

##### `getWalletData(address, fields, options): Promise<SDKResponse<WalletData>>`

Gets wallet data for a Cardano address.

**Parameters:**

- `address: CardanoAddress` - Cardano wallet address
- `fields: WalletDataField[]` - Array of fields to retrieve
- `options?: SDKMethodOptions` - Request options

```typescript
const response = await sdk.getWalletData(
  'addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3n0d3vllmyqwsx5wktcd8cc3sq835lu7drv2xwl2wywfgse35a3x',
  ['balance', 'portfolio', 'transactions'],
);

console.log(response.data.balance);
console.log(response.data.portfolio?.totalValue);
```

##### `getProviderHealth(): Promise<Record<string, ProviderHealth>>`

Gets health status of all providers.

```typescript
const health = await sdk.getProviderHealth();
console.log(health.blockfrost.healthy); // true
console.log(health.coingecko.responseTime); // 150ms
```

##### `getStats(): Promise<SDKStats>`

Gets SDK usage statistics.

```typescript
const stats = await sdk.getStats();
console.log(stats.requests.total); // 1250
console.log(stats.cache.hitRate); // 0.85
console.log(stats.providers.coingecko.avgResponseTime); // 180ms
```

### Data Types

#### TokenData

```typescript
interface TokenData {
  // Price data
  price?: number;
  priceUsd?: number;
  marketCap?: number;
  volume24h?: number;

  // Price changes
  priceChange24h?: number;
  priceChangePercentage24h?: number;
  priceChangePercentage7d?: number;

  // Token metadata
  name?: string;
  symbol?: string;
  decimals?: number;
  description?: string;
  logo?: string;

  // Supply data
  totalSupply?: number;
  circulatingSupply?: number;
  maxSupply?: number;
  holders?: number;

  // Trading data
  high24h?: number;
  low24h?: number;
  ath?: number;
  atl?: number;

  // Metadata
  lastUpdated?: Date;
  dataSource?: string[];
}
```

#### WalletData

```typescript
interface WalletData {
  // Balance information
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

## Examples

### Example 1: Basic Token Price Lookup

```typescript
import { CardalabsSDK } from '@cardalabs/sdk';

async function getAdaPrice() {
  const sdk = new CardalabsSDK({
    providers: {
      coingecko: { apiKey: process.env.COINGECKO_API_KEY! },
    },
  });

  await sdk.initialize();

  const ada = await sdk.getTokenData('lovelace', ['price', 'priceChangePercentage24h']);

  console.log(`ADA Price: $${ada.data.price}`);
  console.log(`24h Change: ${ada.data.priceChangePercentage24h}%`);

  await sdk.destroy();
}
```

### Example 2: Portfolio Analysis

```typescript
import { CardalabsSDK } from '@cardalabs/sdk';

async function analyzePortfolio(walletAddress: string) {
  const sdk = new CardalabsSDK({
    providers: {
      blockfrost: { projectId: process.env.BLOCKFROST_PROJECT_ID! },
      coingecko: { apiKey: process.env.COINGECKO_API_KEY! },
    },
  });

  await sdk.initialize();

  // Get wallet portfolio
  const wallet = await sdk.getWalletData(walletAddress, ['balance', 'portfolio']);

  console.log('Portfolio Analysis:');
  console.log(`Total Value: $${wallet.data.portfolio?.totalValue}`);

  // Analyze each asset
  for (const asset of wallet.data.portfolio?.assets || []) {
    console.log(`${asset.symbol}: ${asset.balance} ($${asset.valueUsd})`);

    // Get detailed token data for each holding
    const tokenData = await sdk.getTokenData(asset.assetUnit, [
      'price',
      'priceChangePercentage24h',
      'marketCap',
    ]);

    console.log(`  Price: $${tokenData.data.price}`);
    console.log(`  24h Change: ${tokenData.data.priceChangePercentage24h}%`);
  }

  await sdk.destroy();
}
```

### Example 3: Multi-Provider Data Aggregation

```typescript
import { CardalabsSDK } from '@cardalabs/sdk';

async function comprehensiveTokenAnalysis(assetUnit: string) {
  const sdk = new CardalabsSDK({
    providers: {
      blockfrost: { projectId: process.env.BLOCKFROST_PROJECT_ID! },
      coingecko: { apiKey: process.env.COINGECKO_API_KEY! },
      dexscreener: { enabled: true },
    },
    providerPriorities: {
      price: ['coingecko', 'dexscreener'],
      name: ['blockfrost'],
      totalSupply: ['blockfrost'],
      volume24h: ['coingecko', 'dexscreener'],
    },
  });

  await sdk.initialize();

  // Get comprehensive token data from multiple providers
  const token = await sdk.getTokenData(assetUnit, [
    'price', // From CoinGecko
    'name', // From Blockfrost
    'symbol', // From Blockfrost
    'marketCap', // From CoinGecko
    'volume24h', // From CoinGecko/DexScreener
    'totalSupply', // From Blockfrost
    'holders', // From TapTools (if configured)
    'priceChange24h', // From CoinGecko
  ]);

  console.log('Token Analysis:');
  console.log(`Name: ${token.data.name} (${token.data.symbol})`);
  console.log(`Price: $${token.data.price}`);
  console.log(`Market Cap: $${token.data.marketCap?.toLocaleString()}`);
  console.log(`24h Volume: $${token.data.volume24h?.toLocaleString()}`);
  console.log(`Total Supply: ${token.data.totalSupply?.toLocaleString()}`);
  console.log(`Data Sources: ${token.metadata?.dataSources.join(', ')}`);

  await sdk.destroy();
}
```

### Example 4: Real-time Price Monitoring

```typescript
import { CardalabsSDK } from '@cardalabs/sdk';

async function monitorPrices(assets: string[]) {
  const sdk = new CardalabsSDK({
    providers: {
      coingecko: { apiKey: process.env.COINGECKO_API_KEY! },
    },
    cache: {
      fieldTtl: {
        price: 10, // 10 second cache for real-time monitoring
      },
    },
  });

  await sdk.initialize();

  // Monitor prices every 15 seconds
  setInterval(async () => {
    console.log('\n--- Price Update ---');

    for (const asset of assets) {
      try {
        const data = await sdk.getTokenData(asset, ['price', 'priceChangePercentage24h']);

        const change = data.data.priceChangePercentage24h || 0;
        const arrow = change >= 0 ? '🟢' : '🔴';

        console.log(`${asset}: $${data.data.price} ${arrow} ${change.toFixed(2)}%`);
      } catch (error) {
        console.error(`Error fetching ${asset}:`, error);
      }
    }
  }, 15000);

  // Cleanup after 5 minutes
  setTimeout(async () => {
    await sdk.destroy();
    process.exit(0);
  }, 300000);
}

// Monitor ADA and popular Cardano tokens
monitorPrices(['lovelace', 'other-asset-ids']);
```

### Example 5: Error Handling and Fallbacks

```typescript
import { CardalabsSDK } from '@cardalabs/sdk';

async function robustDataFetching() {
  const sdk = new CardalabsSDK({
    providers: {
      blockfrost: { projectId: process.env.BLOCKFROST_PROJECT_ID! },
      coingecko: { apiKey: process.env.COINGECKO_API_KEY! },
    },
  });

  await sdk.initialize();

  try {
    const response = await sdk.getTokenData('lovelace', ['price', 'name'], {
      preferredProviders: ['coingecko'],
      fallbackProviders: ['blockfrost'],
      maxRetries: 3,
      timeout: 5000,
    });

    console.log('Data:', response.data);
    console.log('Sources:', response.metadata?.dataSources);

    // Check for any errors
    if (response.errors && response.errors.length > 0) {
      console.log('Partial errors occurred:');
      response.errors.forEach((error) => {
        console.log(`- ${error.provider}: ${error.error}`);
      });
    }
  } catch (error) {
    console.error('Complete failure:', error);
  }

  await sdk.destroy();
}
```

### Request Flow

```
1. SDK.getTokenData() called
2. Check cache for existing data
3. If cache miss, create routing plan
4. Execute requests to providers in parallel
5. Aggregate responses and resolve conflicts
6. Store result in cache
7. Return unified response
```

### Cache Architecture

```
┌─────────────────┐
│  Cache Manager  │
└─────────────────┘
          │
┌─────────┬─────────┬─────────┐
│ Memory  │  Redis  │  File   │ ← Pluggable cache backends
└─────────┴─────────┴─────────┘
```

### Provider Capabilities

Each provider declares its capabilities:

```typescript
// Blockfrost
{
  tokenData: ['name', 'symbol', 'decimals', 'totalSupply'],
  walletData: ['balance', 'transactions'],
  features: { historical: true, realtime: false }
}

// CoinGecko
{
  tokenData: ['price', 'marketCap', 'volume24h', 'priceChange24h'],
  walletData: [],
  features: { historical: true, realtime: false }
}
```
