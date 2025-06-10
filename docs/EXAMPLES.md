# CardaLabs SDK Examples

This document provides comprehensive examples of using the CardaLabs SDK for various use cases.

## Table of Contents

- [Basic Usage](#basic-usage)
- [Provider Configuration](#provider-configuration)
- [Token Data Examples](#token-data-examples)
- [Wallet Data Examples](#wallet-data-examples)
- [Advanced Features](#advanced-features)
- [Error Handling](#error-handling)
- [Performance Optimization](#performance-optimization)
- [Real-world Use Cases](#real-world-use-cases)

## Basic Usage

### Simple Price Lookup

```typescript
import { CardalabsSDK } from '@cardalabs/sdk';

async function getAdaPrice() {
  // Initialize SDK with minimal configuration
  const sdk = new CardalabsSDK({
    providers: {
      coingecko: {
        apiKey: process.env.COINGECKO_API_KEY!,
      },
    },
  });

  await sdk.initialize();

  try {
    // Get ADA price
    const response = await sdk.getTokenData('lovelace', ['price']);
    console.log(`ADA Price: $${response.data.price}`);

    // Check metadata
    console.log(`Data from: ${response.metadata?.dataSources.join(', ')}`);
    console.log(`Response time: ${response.metadata?.responseTime}ms`);
  } finally {
    await sdk.destroy();
  }
}

getAdaPrice();
```

### Basic Wallet Balance

```typescript
import { CardalabsSDK } from '@cardalabs/sdk';

async function getWalletBalance(address: string) {
  const sdk = new CardalabsSDK({
    providers: {
      blockfrost: {
        projectId: process.env.BLOCKFROST_PROJECT_ID!,
      },
    },
  });

  await sdk.initialize();

  try {
    const response = await sdk.getWalletData(address, ['balance']);

    // Display ADA balance
    const adaBalance = response.data.balance?.lovelace || 0;
    console.log(`ADA Balance: ${adaBalance / 1_000_000} ADA`);

    // Display other assets
    Object.entries(response.data.balance || {}).forEach(([asset, amount]) => {
      if (asset !== 'lovelace') {
        console.log(`Asset ${asset}: ${amount}`);
      }
    });
  } finally {
    await sdk.destroy();
  }
}

getWalletBalance('addr1...');
```

## Provider Configuration

### Multi-Provider Setup

```typescript
import { type CardalabsConfig, CardalabsSDK } from '@cardalabs/sdk';

async function setupMultiProviderSDK() {
  const config: CardalabsConfig = {
    providers: {
      // On-chain data provider
      blockfrost: {
        projectId: process.env.BLOCKFROST_PROJECT_ID!,
        enabled: true,
      },

      // Market data provider
      coingecko: {
        apiKey: process.env.COINGECKO_API_KEY!,
        pro: true,
        enabled: true,
      },

      // Portfolio analytics provider
      taptools: {
        apiKey: process.env.TAPTOOLS_API_KEY!,
        enabled: true,
      },

      // DEX data provider (no API key required)
      dexscreener: {
        enabled: true,
      },
    },

    // Configure provider priorities for each field
    providerPriorities: {
      // Price data: prefer CoinGecko, fallback to DexScreener
      price: ['coingecko', 'dexscreener'],
      marketCap: ['coingecko'],

      // On-chain data: use Blockfrost
      name: ['blockfrost', 'coingecko'],
      symbol: ['blockfrost', 'coingecko'],
      balance: ['blockfrost'],

      // Portfolio data: prefer TapTools, fallback to Blockfrost
      portfolio: ['taptools', 'blockfrost'],

      // Volume data: combine sources
      volume24h: ['coingecko', 'dexscreener'],
    },

    // Cache configuration
    cache: {
      defaultTtl: 300, // 5 minutes
      fieldTtl: {
        price: 30, // Price changes frequently
        marketCap: 60, // Market cap less frequent
        balance: 120, // Balance moderate frequency
        name: 3600, // Metadata rarely changes
        symbol: 3600,
      },
    },

    // Health monitoring
    healthCheck: {
      enabled: true,
      interval: 300, // Check every 5 minutes
      timeout: 10000, // 10 second timeout
    },
  };

  const sdk = new CardalabsSDK(config);
  await sdk.initialize();

  return sdk;
}
```

### Environment-Based Configuration

```typescript
// config.ts
import { CardalabsConfig } from '@cardalabs/sdk';

// .env file
BLOCKFROST_PROJECT_ID = mainnet_project_id_here;
COINGECKO_API_KEY = your_coingecko_api_key;
TAPTOOLS_API_KEY = your_taptools_api_key;
NODE_ENV = production;

export function createSDKConfig(): CardalabsConfig {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    providers: {
      blockfrost: {
        projectId: process.env.BLOCKFROST_PROJECT_ID!,
        baseUrl: isProduction
          ? 'https://cardano-mainnet.blockfrost.io/api/v0'
          : 'https://cardano-testnet.blockfrost.io/api/v0',
      },

      coingecko: {
        apiKey: process.env.COINGECKO_API_KEY!,
        pro: isProduction,
      },
    },

    cache: {
      defaultTtl: isProduction ? 300 : 60, // Shorter cache in development
      maxSize: isProduction ? 10000 : 100,
    },

    defaultRequestOptions: {
      timeout: isProduction ? 10000 : 5000,
      maxRetries: isProduction ? 3 : 1,
    },
  };
}
```

## Token Data Examples

### Comprehensive Token Analysis

```typescript
async function analyzeToken(assetUnit: string) {
  const sdk = await setupMultiProviderSDK();

  try {
    // Get comprehensive token data
    const response = await sdk.getTokenData(assetUnit, [
      // Price and market data (from CoinGecko)
      'price',
      'priceUsd',
      'marketCap',
      'volume24h',
      'priceChange24h',
      'priceChangePercentage24h',
      'priceChangePercentage7d',
      'high24h',
      'low24h',
      'ath',
      'atl',

      // Token metadata (from Blockfrost)
      'name',
      'symbol',
      'decimals',
      'description',
      'totalSupply',
      'circulatingSupply',

      // Additional data (from TapTools if available)
      'holders',
    ]);

    const token = response.data;

    console.log('=== TOKEN ANALYSIS ===');
    console.log(`Name: ${token.name} (${token.symbol})`);
    console.log(`Price: $${token.price?.toFixed(6)}`);
    console.log(`Market Cap: $${token.marketCap?.toLocaleString()}`);
    console.log(`24h Volume: $${token.volume24h?.toLocaleString()}`);
    console.log(`24h Change: ${token.priceChangePercentage24h?.toFixed(2)}%`);
    console.log(`7d Change: ${token.priceChangePercentage7d?.toFixed(2)}%`);
    console.log(`All-time High: $${token.ath?.toFixed(6)}`);
    console.log(`All-time Low: $${token.atl?.toFixed(6)}`);
    console.log(`Total Supply: ${token.totalSupply?.toLocaleString()}`);
    console.log(`Circulating Supply: ${token.circulatingSupply?.toLocaleString()}`);
    console.log(`Holder Count: ${token.holders?.toLocaleString()}`);

    console.log('\n=== METADATA ===');
    console.log(`Data Sources: ${response.metadata?.dataSources.join(', ')}`);
    console.log(`Response Time: ${response.metadata?.responseTime}ms`);
    console.log(`Cache Status: ${response.metadata?.cacheStatus}`);

    // Check for any errors
    if (response.errors && response.errors.length > 0) {
      console.log('\n=== WARNINGS ===');
      response.errors.forEach((error) => {
        console.log(`${error.provider}: ${error.error}`);
      });
    }
  } finally {
    await sdk.destroy();
  }
}

// Analyze ADA
analyzeToken('lovelace');
```

### Price Monitoring with Alerts

```typescript
class PriceMonitor {
  private sdk: CardalabsSDK;
  private alerts: Map<string, { threshold: number; direction: 'above' | 'below' }> = new Map();

  constructor(sdk: CardalabsSDK) {
    this.sdk = sdk;
  }

  // Add price alert
  addAlert(assetUnit: string, threshold: number, direction: 'above' | 'below') {
    this.alerts.set(assetUnit, { threshold, direction });
  }

  // Start monitoring
  async startMonitoring(intervalMs: number = 30000) {
    console.log('Starting price monitoring...');

    setInterval(async () => {
      await this.checkPrices();
    }, intervalMs);
  }

  private async checkPrices() {
    for (const [assetUnit, alert] of this.alerts.entries()) {
      try {
        const response = await this.sdk.getTokenData(assetUnit, [
          'price',
          'priceChangePercentage24h',
        ]);

        const price = response.data.price;
        const change24h = response.data.priceChangePercentage24h;

        if (price && this.shouldAlert(price, alert)) {
          this.triggerAlert(assetUnit, price, change24h || 0);
        }
      } catch (error) {
        console.error(`Error monitoring ${assetUnit}:`, error);
      }
    }
  }

  private shouldAlert(
    price: number,
    alert: { threshold: number; direction: 'above' | 'below' },
  ): boolean {
    return alert.direction === 'above' ? price > alert.threshold : price < alert.threshold;
  }

  private triggerAlert(assetUnit: string, price: number, change24h: number) {
    const emoji = change24h >= 0 ? '🟢' : '🔴';
    console.log(
      `🚨 PRICE ALERT: ${assetUnit} is now $${price} ${emoji} (${change24h.toFixed(2)}%)`,
    );

    // Here you could send notifications, webhooks, etc.
  }
}

// Usage
async function setupPriceMonitoring() {
  const sdk = await setupMultiProviderSDK();
  const monitor = new PriceMonitor(sdk);

  // Set up alerts
  monitor.addAlert('lovelace', 0.5, 'above'); // Alert when ADA > $0.50
  monitor.addAlert('lovelace', 0.3, 'below'); // Alert when ADA < $0.30

  // Start monitoring every 30 seconds
  await monitor.startMonitoring(30000);
}
```

### Batch Token Analysis

```typescript
async function analyzeTokenPortfolio(assetUnits: string[]) {
  const sdk = await setupMultiProviderSDK();

  try {
    // Get data for all tokens in parallel
    const promises = assetUnits.map(async (assetUnit) => {
      const response = await sdk.getTokenData(assetUnit, [
        'name',
        'symbol',
        'price',
        'marketCap',
        'priceChangePercentage24h',
        'volume24h',
      ]);

      return {
        assetUnit,
        ...response.data,
        errors: response.errors,
      };
    });

    const results = await Promise.all(promises);

    // Sort by market cap
    const sortedTokens = results
      .filter((token) => token.marketCap)
      .sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));

    console.log('=== TOKEN PORTFOLIO ANALYSIS ===');
    console.log('Rank | Name (Symbol) | Price | Market Cap | 24h Change | 24h Volume');
    console.log('-----|---------------|-------|------------|------------|------------');

    sortedTokens.forEach((token, index) => {
      const rank = (index + 1).toString().padStart(4);
      const name = `${token.name} (${token.symbol})`.padEnd(14);
      const price = `$${token.price?.toFixed(4) || 'N/A'}`.padStart(8);
      const marketCap = `$${(token.marketCap || 0).toLocaleString()}`.padStart(12);
      const change = `${(token.priceChangePercentage24h || 0).toFixed(2)}%`.padStart(8);
      const volume = `$${(token.volume24h || 0).toLocaleString()}`.padStart(12);

      console.log(`${rank} | ${name} | ${price} | ${marketCap} | ${change} | ${volume}`);
    });

    // Calculate total portfolio value (if you have holdings)
    const totalMarketCap = sortedTokens.reduce((sum, token) => sum + (token.marketCap || 0), 0);
    console.log(`\nTotal Market Cap: $${totalMarketCap.toLocaleString()}`);
  } finally {
    await sdk.destroy();
  }
}

// Analyze top Cardano ecosystem tokens
analyzeTokenPortfolio([
  'lovelace',
  // Add other Cardano native token asset units here
  // 'policy_id.asset_name',
]);
```

## Wallet Data Examples

### Portfolio Analysis

```typescript
async function analyzeWalletPortfolio(address: string) {
  const sdk = await setupMultiProviderSDK();

  try {
    // Get comprehensive wallet data
    const response = await sdk.getWalletData(address, [
      'balance',
      'portfolio',
      'transactions',
      'staking',
    ]);

    const wallet = response.data;

    console.log('=== WALLET PORTFOLIO ANALYSIS ===');
    console.log(`Address: ${address.slice(0, 20)}...${address.slice(-10)}`);

    // ADA Holdings
    const adaBalance = wallet.balance?.lovelace || 0;
    console.log(`\nADA Holdings: ${(adaBalance / 1_000_000).toFixed(2)} ADA`);

    // Portfolio Overview
    if (wallet.portfolio) {
      console.log(`Total Portfolio Value: $${wallet.portfolio.totalValueUsd?.toFixed(2) || 'N/A'}`);
      console.log(`Number of Assets: ${wallet.portfolio.assets?.length || 0}`);
      console.log(`Number of NFTs: ${wallet.portfolio.nfts?.length || 0}`);
    }

    // Asset Breakdown
    if (wallet.portfolio?.assets && wallet.portfolio.assets.length > 0) {
      console.log('\n=== ASSET BREAKDOWN ===');
      console.log('Asset | Balance | Value | Percentage | 24h Change');
      console.log('------|---------|-------|------------|------------');

      for (const asset of wallet.portfolio.assets) {
        // Get current price data for each asset
        const tokenData = await sdk.getTokenData(asset.assetUnit, [
          'price',
          'priceChangePercentage24h',
        ]);

        const name = asset.symbol || asset.assetUnit.slice(0, 10);
        const balance = asset.balance.toLocaleString();
        const value = asset.valueUsd ? `$${asset.valueUsd.toFixed(2)}` : 'N/A';
        const percentage = asset.percentage ? `${asset.percentage.toFixed(1)}%` : 'N/A';
        const change = tokenData.data.priceChangePercentage24h
          ? `${tokenData.data.priceChangePercentage24h.toFixed(2)}%`
          : 'N/A';

        console.log(
          `${name.padEnd(5)} | ${balance.padStart(8)} | ${value.padStart(6)} | ${percentage.padStart(9)} | ${change.padStart(9)}`,
        );
      }
    }

    // NFT Holdings
    if (wallet.portfolio?.nfts && wallet.portfolio.nfts.length > 0) {
      console.log('\n=== NFT HOLDINGS ===');
      console.log(`Total NFTs: ${wallet.portfolio.nfts.length}`);

      const nftsByCollection = wallet.portfolio.nfts.reduce(
        (acc, nft) => {
          const collection = nft.collection || 'Unknown';
          acc[collection] = (acc[collection] || 0) + nft.balance;
          return acc;
        },
        {} as Record<string, number>,
      );

      Object.entries(nftsByCollection).forEach(([collection, count]) => {
        console.log(`${collection}: ${count} NFTs`);
      });
    }

    // Staking Information
    if (wallet.staking) {
      console.log('\n=== STAKING ===');
      console.log(`Total Staked: ${(wallet.staking.totalStaked || 0) / 1_000_000} ADA`);
      console.log(`Rewards: ${(wallet.staking.rewards || 0) / 1_000_000} ADA`);

      if (wallet.staking.pools && wallet.staking.pools.length > 0) {
        console.log('\nStaking Pools:');
        wallet.staking.pools.forEach((pool) => {
          console.log(
            `- ${pool.poolName || pool.poolId}: ${pool.stakedAmount / 1_000_000} ADA (APY: ${pool.apy || 'N/A'}%)`,
          );
        });
      }
    }

    // Recent Transactions
    if (wallet.transactions && wallet.transactions.length > 0) {
      console.log('\n=== RECENT TRANSACTIONS ===');
      console.log('Date | Type | Amount | Status');
      console.log('-----|------|--------|-------');

      wallet.transactions.slice(0, 10).forEach((tx) => {
        const date = tx.timestamp.toLocaleDateString();
        const type = tx.type.padEnd(7);
        const amount = tx.amount ? `${(tx.amount / 1_000_000).toFixed(2)} ADA` : 'N/A';
        const status = tx.status;

        console.log(`${date} | ${type} | ${amount.padStart(10)} | ${status}`);
      });
    }
  } finally {
    await sdk.destroy();
  }
}

// Analyze a wallet
analyzeWalletPortfolio('addr1...');
```

### Multi-Wallet Comparison

```typescript
async function compareWallets(addresses: string[]) {
  const sdk = await setupMultiProviderSDK();

  try {
    console.log('=== MULTI-WALLET COMPARISON ===');

    const walletData = await Promise.all(
      addresses.map(async (address, index) => {
        const response = await sdk.getWalletData(address, ['balance', 'portfolio']);

        const adaBalance = response.data.balance?.lovelace || 0;
        const totalValue = response.data.portfolio?.totalValueUsd || 0;
        const assetCount = response.data.portfolio?.assets?.length || 0;
        const nftCount = response.data.portfolio?.nfts?.length || 0;

        return {
          index: index + 1,
          address: `${address.slice(0, 15)}...${address.slice(-10)}`,
          adaBalance: adaBalance / 1_000_000,
          totalValue,
          assetCount,
          nftCount,
        };
      }),
    );

    console.log('Wallet | Address | ADA Balance | Total Value | Assets | NFTs');
    console.log('-------|---------|-------------|-------------|--------|-----');

    walletData.forEach((wallet) => {
      const index = wallet.index.toString().padStart(6);
      const address = wallet.address.padEnd(25);
      const ada = wallet.adaBalance.toFixed(2).padStart(11);
      const value = `$${wallet.totalValue.toFixed(2)}`.padStart(11);
      const assets = wallet.assetCount.toString().padStart(6);
      const nfts = wallet.nftCount.toString().padStart(4);

      console.log(`${index} | ${address} | ${ada} | ${value} | ${assets} | ${nfts}`);
    });

    // Summary statistics
    const totalAda = walletData.reduce((sum, w) => sum + w.adaBalance, 0);
    const totalValue = walletData.reduce((sum, w) => sum + w.totalValue, 0);
    const totalAssets = walletData.reduce((sum, w) => sum + w.assetCount, 0);
    const totalNfts = walletData.reduce((sum, w) => sum + w.nftCount, 0);

    console.log('\n=== SUMMARY ===');
    console.log(`Total ADA: ${totalAda.toFixed(2)} ADA`);
    console.log(`Total Value: $${totalValue.toFixed(2)}`);
    console.log(`Total Assets: ${totalAssets}`);
    console.log(`Total NFTs: ${totalNfts}`);
  } finally {
    await sdk.destroy();
  }
}
```

## Advanced Features

### Custom Caching Strategy

```typescript
import { CacheInterface, CacheStats } from '@cardalabs/sdk';

class RedisCache implements CacheInterface {
  private client: any; // Redis client

  constructor(redisClient: any) {
    this.client = redisClient;
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    return value ? JSON.parse(value) : null;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttl) {
      await this.client.setex(key, ttl, serialized);
    } else {
      await this.client.set(key, serialized);
    }
  }

  async delete(key: string): Promise<boolean> {
    const result = await this.client.del(key);
    return result > 0;
  }

  async clear(): Promise<void> {
    await this.client.flushdb();
  }

  async has(key: string): Promise<boolean> {
    const exists = await this.client.exists(key);
    return exists === 1;
  }

  async getStats(): Promise<CacheStats> {
    // Implement Redis-specific stats
    return {
      hits: 0,
      misses: 0,
      hitRate: 0,
      size: 0,
    };
  }

  async close(): Promise<void> {
    await this.client.quit();
  }
}

// Usage with custom cache
async function setupSDKWithRedisCache() {
  const redis = require('redis');
  const redisClient = redis.createClient({
    host: 'localhost',
    port: 6379,
  });

  const sdk = new CardalabsSDK({
    providers: {
      coingecko: { apiKey: process.env.COINGECKO_API_KEY! },
    },
    cache: {
      type: 'custom',
      customCache: new RedisCache(redisClient),
    },
  });

  await sdk.initialize();
  return sdk;
}
```

### Event-Driven Architecture

```typescript
class TradingBot {
  private sdk: CardalabsSDK;
  private positions: Map<string, { quantity: number; entryPrice: number }> = new Map();

  constructor(sdk: CardalabsSDK) {
    this.sdk = sdk;
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Monitor price changes
    this.sdk.addEventListener('request.complete', (event, data) => {
      if (data.type === 'token' && data.fields.includes('price')) {
        this.onPriceUpdate(data.assetUnit, data.price);
      }
    });

    // Monitor provider health
    this.sdk.addEventListener('provider.unhealthy', (event, data) => {
      console.warn(`Provider ${data.provider} is unhealthy, adjusting strategy...`);
      this.handleProviderOutage(data.provider);
    });

    // Monitor cache performance
    this.sdk.addEventListener('cache.miss', (event, data) => {
      // Could trigger pre-fetching of related data
      this.prefetchRelatedData(data.key);
    });
  }

  private async onPriceUpdate(assetUnit: string, price: number) {
    const position = this.positions.get(assetUnit);
    if (!position) return;

    const profitLoss = (price - position.entryPrice) / position.entryPrice;

    // Simple profit-taking strategy
    if (profitLoss > 0.1) {
      // 10% profit
      console.log(`Taking profit on ${assetUnit} at ${profitLoss * 100}% gain`);
      await this.closePosition(assetUnit);
    } else if (profitLoss < -0.05) {
      // 5% stop-loss
      console.log(`Stop-loss triggered on ${assetUnit} at ${profitLoss * 100}% loss`);
      await this.closePosition(assetUnit);
    }
  }

  private handleProviderOutage(provider: string) {
    // Implement fallback logic
    console.log(`Switching to backup providers due to ${provider} outage`);
  }

  private async prefetchRelatedData(cacheKey: string) {
    // Implement predictive data fetching
  }

  private async closePosition(assetUnit: string) {
    this.positions.delete(assetUnit);
    console.log(`Position closed for ${assetUnit}`);
  }
}
```

### Performance Optimization

```typescript
class OptimizedDataFetcher {
  private sdk: CardalabsSDK;
  private requestQueue: Map<string, Promise<any>> = new Map();

  constructor(sdk: CardalabsSDK) {
    this.sdk = sdk;
  }

  // Request deduplication
  async getTokenDataWithDeduplication(assetUnit: string, fields: string[]) {
    const cacheKey = `${assetUnit}-${fields.sort().join(',')}`;

    // Check if same request is already in flight
    if (this.requestQueue.has(cacheKey)) {
      return await this.requestQueue.get(cacheKey);
    }

    // Create new request
    const promise = this.sdk.getTokenData(assetUnit, fields as any);
    this.requestQueue.set(cacheKey, promise);

    try {
      const result = await promise;
      return result;
    } finally {
      // Clean up after request completes
      this.requestQueue.delete(cacheKey);
    }
  }

  // Batch processing with concurrency control
  async batchProcessTokens(assetUnits: string[], concurrency: number = 5) {
    const results: any[] = [];

    for (let i = 0; i < assetUnits.length; i += concurrency) {
      const batch = assetUnits.slice(i, i + concurrency);

      const batchPromises = batch.map((assetUnit) =>
        this.getTokenDataWithDeduplication(assetUnit, ['price', 'marketCap']),
      );

      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  // Smart prefetching based on usage patterns
  async prefetchPopularTokens() {
    const popularTokens = [
      'lovelace',
      // Add other popular asset units
    ];

    // Prefetch in background without blocking
    Promise.all(
      popularTokens.map((assetUnit) =>
        this.getTokenDataWithDeduplication(assetUnit, ['price', 'marketCap']).catch((error) =>
          console.warn(`Prefetch failed for ${assetUnit}:`, error),
        ),
      ),
    );
  }
}
```

## Error Handling

### Comprehensive Error Handling

```typescript
import {
  CardalabsError,
  NetworkError,
  RateLimitError,
  TimeoutError,
  ValidationError,
} from '@cardalabs/sdk';

async function robustDataFetching(assetUnit: string) {
  const sdk = await setupMultiProviderSDK();

  try {
    const response = await sdk.getTokenData(assetUnit, ['price', 'marketCap'], {
      timeout: 10000,
      maxRetries: 3,
      preferredProviders: ['coingecko'],
      fallbackProviders: ['dexscreener'],
    });

    // Check for partial errors
    if (response.errors && response.errors.length > 0) {
      console.warn('Partial errors occurred:');
      response.errors.forEach((error) => {
        console.warn(`- ${error.provider}: ${error.error} (Recoverable: ${error.recoverable})`);
      });
    }

    return response.data;
  } catch (error) {
    if (error instanceof ValidationError) {
      console.error('Invalid asset unit:', error.message);
      // Handle validation error
    } else if (error instanceof RateLimitError) {
      console.error('Rate limit exceeded:', error.message);
      // Implement backoff strategy
    } else if (error instanceof TimeoutError) {
      console.error('Request timed out:', error.message);
      // Maybe retry with longer timeout
    } else if (error instanceof NetworkError) {
      console.error('Network error:', error.message);
      // Check network connectivity
    } else if (error instanceof CardalabsError) {
      console.error('SDK error:', error.message, error.context);
      // Generic SDK error handling
    } else {
      console.error('Unexpected error:', error);
      // Handle unknown errors
    }

    throw error;
  } finally {
    await sdk.destroy();
  }
}
```

### Retry with Exponential Backoff

```typescript
class RetryableSDK {
  private sdk: CardalabsSDK;

  constructor(sdk: CardalabsSDK) {
    this.sdk = sdk;
  }

  async getTokenDataWithRetry(assetUnit: string, fields: string[], maxRetries: number = 3) {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.sdk.getTokenData(assetUnit, fields as any);
      } catch (error) {
        lastError = error as Error;

        // Don't retry validation errors
        if (error instanceof ValidationError) {
          throw error;
        }

        if (attempt === maxRetries) {
          throw lastError;
        }

        // Exponential backoff: 1s, 2s, 4s, 8s...
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

## Real-world Use Cases

### DeFi Portfolio Tracker

```typescript
class DeFiPortfolioTracker {
  private sdk: CardalabsSDK;

  constructor(sdk: CardalabsSDK) {
    this.sdk = sdk;
  }

  async trackPortfolio(walletAddresses: string[]) {
    console.log('=== DeFi PORTFOLIO TRACKER ===');

    let totalValue = 0;
    const portfolioBreakdown: any[] = [];

    for (const address of walletAddresses) {
      console.log(`\nAnalyzing wallet: ${address.slice(0, 20)}...`);

      const walletData = await this.sdk.getWalletData(address, ['balance', 'portfolio', 'staking']);

      // Calculate wallet value
      const walletValue = await this.calculateWalletValue(walletData.data);
      totalValue += walletValue;

      portfolioBreakdown.push({
        address,
        value: walletValue,
        adaBalance: (walletData.data.balance?.lovelace || 0) / 1_000_000,
        assetCount: walletData.data.portfolio?.assets?.length || 0,
        stakingRewards: (walletData.data.staking?.rewards || 0) / 1_000_000,
      });
    }

    // Display results
    console.log('\n=== PORTFOLIO SUMMARY ===');
    console.log(`Total Portfolio Value: $${totalValue.toFixed(2)}`);
    console.log(`Number of Wallets: ${walletAddresses.length}`);

    portfolioBreakdown.forEach((wallet, index) => {
      console.log(`\nWallet ${index + 1}:`);
      console.log(`  Value: $${wallet.value.toFixed(2)}`);
      console.log(`  ADA: ${wallet.adaBalance.toFixed(2)}`);
      console.log(`  Assets: ${wallet.assetCount}`);
      console.log(`  Staking Rewards: ${wallet.stakingRewards.toFixed(2)} ADA`);
    });

    return {
      totalValue,
      walletCount: walletAddresses.length,
      breakdown: portfolioBreakdown,
    };
  }

  private async calculateWalletValue(walletData: any): Promise<number> {
    let totalValue = 0;

    // Calculate ADA value
    const adaBalance = (walletData.balance?.lovelace || 0) / 1_000_000;
    const adaPrice = await this.getAdaPrice();
    totalValue += adaBalance * adaPrice;

    // Calculate other assets value
    if (walletData.portfolio?.assets) {
      for (const asset of walletData.portfolio.assets) {
        if (asset.valueUsd) {
          totalValue += asset.valueUsd;
        }
      }
    }

    return totalValue;
  }

  private async getAdaPrice(): Promise<number> {
    const response = await this.sdk.getTokenData('lovelace', ['price']);
    return response.data.price || 0;
  }
}
```

### Arbitrage Opportunity Scanner

```typescript
class ArbitrageScanner {
  private sdk: CardalabsSDK;

  constructor(sdk: CardalabsSDK) {
    this.sdk = sdk;
  }

  async scanForArbitrage(assetUnits: string[], minProfitPercent: number = 2) {
    console.log('=== ARBITRAGE OPPORTUNITY SCANNER ===');

    const opportunities: any[] = [];

    for (const assetUnit of assetUnits) {
      try {
        // Get prices from multiple providers
        const prices = await this.getPricesFromMultipleProviders(assetUnit);

        if (prices.length >= 2) {
          const sortedPrices = prices.sort((a, b) => a.price - b.price);
          const lowest = sortedPrices[0];
          const highest = sortedPrices[sortedPrices.length - 1];

          const profitPercent = ((highest.price - lowest.price) / lowest.price) * 100;

          if (profitPercent >= minProfitPercent) {
            opportunities.push({
              assetUnit,
              buyFrom: lowest.provider,
              sellTo: highest.provider,
              buyPrice: lowest.price,
              sellPrice: highest.price,
              profitPercent: profitPercent.toFixed(2),
              spread: highest.price - lowest.price,
            });
          }
        }
      } catch (error) {
        console.error(`Error scanning ${assetUnit}:`, error);
      }
    }

    // Display opportunities
    if (opportunities.length > 0) {
      console.log('\n=== ARBITRAGE OPPORTUNITIES FOUND ===');
      console.log('Asset | Buy From | Sell To | Buy Price | Sell Price | Profit %');
      console.log('------|----------|---------|-----------|------------|----------');

      opportunities
        .sort((a, b) => parseFloat(b.profitPercent) - parseFloat(a.profitPercent))
        .forEach((opp) => {
          const asset = opp.assetUnit.slice(0, 8);
          const buyFrom = opp.buyFrom.padEnd(8);
          const sellTo = opp.sellTo.padEnd(8);
          const buyPrice = `$${opp.buyPrice.toFixed(4)}`;
          const sellPrice = `$${opp.sellPrice.toFixed(4)}`;
          const profit = `${opp.profitPercent}%`;

          console.log(`${asset} | ${buyFrom} | ${sellTo} | ${buyPrice} | ${sellPrice} | ${profit}`);
        });
    } else {
      console.log('No arbitrage opportunities found.');
    }

    return opportunities;
  }

  private async getPricesFromMultipleProviders(assetUnit: string) {
    const providers = ['coingecko', 'dexscreener'];
    const prices: any[] = [];

    for (const provider of providers) {
      try {
        const response = await this.sdk.getTokenData(assetUnit, ['price'], {
          preferredProviders: [provider],
          fallbackProviders: [],
        });

        if (response.data.price) {
          prices.push({
            provider,
            price: response.data.price,
          });
        }
      } catch (error) {
        console.warn(`Failed to get price from ${provider} for ${assetUnit}`);
      }
    }

    return prices;
  }
}
```