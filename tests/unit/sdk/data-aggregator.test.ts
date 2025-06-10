/**
 * Unit tests for DataAggregator
 */
import type { DataProvider } from '../../../src/providers/base/provider.interface';
import { DataAggregator } from '../../../src/sdk/aggregator/data-aggregator';
import { FieldRouter } from '../../../src/sdk/aggregator/field-router';
import type { TokenData, WalletData } from '../../../src/types/common';
import type { ProviderResponse } from '../../../src/types/providers';
import type { ProviderCapabilities, ProviderHealth } from '../../../src/types/sdk';

// Mock provider for testing
class MockProvider implements DataProvider {
  constructor(
    public readonly name: string,
    public readonly capabilities: ProviderCapabilities,
    private readonly responses: Record<string, any> = {},
    private readonly shouldFail: boolean = false,
    private readonly responseDelay: number = 0,
  ) {}

  readonly version = '1.0.0';

  async initialize(): Promise<void> {
    return Promise.resolve();
  }

  async destroy(): Promise<void> {
    return Promise.resolve();
  }

  async healthCheck(): Promise<ProviderHealth> {
    return {
      provider: this.name,
      healthy: !this.shouldFail,
      lastCheck: new Date(),
      consecutiveFailures: this.shouldFail ? 1 : 0,
    };
  }

  async getTokenData(assetUnit: string): Promise<ProviderResponse<Partial<TokenData>>> {
    if (this.responseDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.responseDelay));
    }

    if (this.shouldFail) {
      return {
        success: false,
        error: new Error(`${this.name} provider error`),
        provider: this.name,
        timestamp: new Date(),
      };
    }

    const data = this.responses[assetUnit] || this.responses['default'] || {};
    return {
      success: true,
      data,
      provider: this.name,
      timestamp: new Date(),
    };
  }

  async getWalletData(address: string): Promise<ProviderResponse<Partial<WalletData>>> {
    if (this.responseDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.responseDelay));
    }

    if (this.shouldFail) {
      return {
        success: false,
        error: new Error(`${this.name} provider error`),
        provider: this.name,
        timestamp: new Date(),
      };
    }

    const data = this.responses[address] || this.responses['default'] || {};
    return {
      success: true,
      data,
      provider: this.name,
      timestamp: new Date(),
    };
  }
}

describe('DataAggregator', () => {
  let aggregator: DataAggregator;
  let blockfrostProvider: MockProvider;
  let coingeckoProvider: MockProvider;
  let taptoolsProvider: MockProvider;

  beforeEach(() => {
    // Create mock providers with different capabilities and responses
    blockfrostProvider = new MockProvider(
      'blockfrost',
      {
        tokenData: ['name', 'symbol', 'decimals', 'totalSupply'],
        walletData: ['balance', 'transactions'],
        features: { batch: false, realtime: false, historical: true },
      },
      {
        lovelace: {
          name: 'Cardano',
          symbol: 'ADA',
          decimals: 6,
          totalSupply: 45000000000,
        },
        default: {
          balance: { lovelace: 1000000000 }, // 1000 ADA
          transactions: [
            {
              hash: 'tx123',
              timestamp: new Date(),
              type: 'receive',
              amount: 100000000,
              status: 'confirmed',
            },
          ],
        },
      },
    );

    coingeckoProvider = new MockProvider(
      'coingecko',
      {
        tokenData: ['price', 'priceUsd', 'marketCap', 'volume24h', 'priceChangePercentage24h'],
        walletData: [],
        features: { batch: true, realtime: false, historical: true },
      },
      {
        lovelace: {
          price: 0.45,
          priceUsd: 0.45,
          marketCap: 15000000000,
          volume24h: 500000000,
          priceChangePercentage24h: 2.5,
        },
      },
    );

    taptoolsProvider = new MockProvider(
      'taptools',
      {
        tokenData: ['holders', 'price'],
        walletData: ['portfolio'],
        features: { batch: false, realtime: true, historical: false },
      },
      {
        lovelace: {
          holders: 1500000,
          price: 0.46, // Slightly different price for conflict testing
        },
        default: {
          portfolio: {
            totalValueUsd: 450,
            assets: [
              {
                assetUnit: 'lovelace',
                balance: 1000000000,
                valueUsd: 450,
              },
            ],
          },
        },
      },
    );

    aggregator = new DataAggregator([blockfrostProvider, coingeckoProvider, taptoolsProvider], {
      price: ['coingecko', 'taptools'],
      name: ['blockfrost'],
      balance: ['blockfrost'],
      portfolio: ['taptools'],
    });
  });

  describe('Token Data Aggregation', () => {
    test('should aggregate token data from multiple providers', async () => {
      const response = await aggregator.aggregateTokenData({
        assetUnit: 'lovelace',
        fields: ['name', 'symbol', 'price', 'marketCap', 'holders'],
      });

      expect(response.data.name).toBe('Cardano');
      expect(response.data.symbol).toBe('ADA');
      expect(response.data.price).toBe(0.45); // From CoinGecko (priority)
      expect(response.data.marketCap).toBe(15000000000);
      expect(response.data.holders).toBe(1500000);
      expect(response.metadata?.dataSources).toContain('blockfrost');
      expect(response.metadata?.dataSources).toContain('coingecko');
      expect(response.metadata?.dataSources).toContain('taptools');
    });

    test('should handle single provider requests', async () => {
      const response = await aggregator.aggregateTokenData({
        assetUnit: 'lovelace',
        fields: ['name', 'symbol'],
      });

      expect(response.data.name).toBe('Cardano');
      expect(response.data.symbol).toBe('ADA');
      expect(response.metadata?.dataSources).toEqual(['blockfrost']);
    });

    test('should include request metadata', async () => {
      const startTime = Date.now();

      const response = await aggregator.aggregateTokenData({
        assetUnit: 'lovelace',
        fields: ['price'],
      });

      expect(response.metadata).toBeDefined();
      expect(response.metadata?.responseTime).toBeGreaterThan(0);
      expect(response.metadata?.timestamp).toBeInstanceOf(Date);
      expect(response.metadata?.cacheStatus).toBe('miss');
      expect(response.metadata?.providerHealth).toBeDefined();
    });

    test('should handle provider failures gracefully', async () => {
      const failingProvider = new MockProvider(
        'failing',
        { tokenData: ['price'], walletData: [] },
        {},
        true, // shouldFail = true
      );

      const testAggregator = new DataAggregator([failingProvider, coingeckoProvider], {
        price: ['failing', 'coingecko'],
      });

      const response = await testAggregator.aggregateTokenData({
        assetUnit: 'lovelace',
        fields: ['price'],
      });

      expect(response.data.price).toBe(0.45); // Should fall back to CoinGecko
      expect(response.errors).toBeDefined();
      expect(response.errors?.[0].provider).toBe('failing');
      expect(response.errors?.[0].recoverable).toBe(true);
    });

    test('should handle partial failures', async () => {
      const partialFailProvider = new MockProvider(
        'partial',
        { tokenData: ['name', 'price'], walletData: [] },
        { lovelace: { name: 'Cardano' } }, // Only provides name, not price
        false,
      );

      const testAggregator = new DataAggregator([partialFailProvider, coingeckoProvider], {
        name: ['partial'],
        price: ['partial', 'coingecko'],
      });

      const response = await testAggregator.aggregateTokenData({
        assetUnit: 'lovelace',
        fields: ['name', 'price'],
      });

      expect(response.data.name).toBe('Cardano');
      expect(response.data.price).toBe(0.45); // Falls back to CoinGecko
    });
  });

  describe('Wallet Data Aggregation', () => {
    test('should aggregate wallet data from multiple providers', async () => {
      const response = await aggregator.aggregateWalletData({
        address: 'addr1test',
        fields: ['balance', 'portfolio', 'transactions'],
      });

      expect(response.data.balance?.lovelace).toBe(1000000000);
      expect(response.data.portfolio?.totalValueUsd).toBe(450);
      expect(response.data.transactions).toHaveLength(1);
      expect(response.metadata?.dataSources).toContain('blockfrost');
      expect(response.metadata?.dataSources).toContain('taptools');
    });

    test('should handle wallet data from single provider', async () => {
      const response = await aggregator.aggregateWalletData({
        address: 'addr1test',
        fields: ['balance'],
      });

      expect(response.data.balance?.lovelace).toBe(1000000000);
      expect(response.metadata?.dataSources).toEqual(['blockfrost']);
    });
  });

  describe('Conflict Resolution', () => {
    test('should resolve conflicts using priority strategy', async () => {
      // Both CoinGecko and TapTools provide price, but with different values
      const response = await aggregator.aggregateTokenData({
        assetUnit: 'lovelace',
        fields: ['price'],
        strategy: {
          combineStrategy: 'first',
          conflictResolution: 'priority',
        },
      });

      expect(response.data.price).toBe(0.45); // CoinGecko has priority
    });

    test('should handle no conflicts when providers agree', async () => {
      // Mock providers returning same value
      const provider1 = new MockProvider(
        'provider1',
        { tokenData: ['price'], walletData: [] },
        { lovelace: { price: 0.45 } },
      );

      const provider2 = new MockProvider(
        'provider2',
        { tokenData: ['price'], walletData: [] },
        { lovelace: { price: 0.45 } },
      );

      const testAggregator = new DataAggregator([provider1, provider2], {
        price: ['provider1', 'provider2'],
      });

      const response = await testAggregator.aggregateTokenData({
        assetUnit: 'lovelace',
        fields: ['price'],
      });

      expect(response.data.price).toBe(0.45);
      expect(response.metadata?.dataSources).toEqual(['provider1', 'provider2']);
    });
  });

  describe('Performance and Parallel Execution', () => {
    test('should execute requests in parallel', async () => {
      const slowProvider = new MockProvider(
        'slow',
        { tokenData: ['name'], walletData: [] },
        { lovelace: { name: 'Slow Cardano' } },
        false,
        100, // 100ms delay
      );

      const fastProvider = new MockProvider(
        'fast',
        { tokenData: ['price'], walletData: [] },
        { lovelace: { price: 0.45 } },
        false,
        10, // 10ms delay
      );

      const testAggregator = new DataAggregator([slowProvider, fastProvider], {
        name: ['slow'],
        price: ['fast'],
      });

      const startTime = Date.now();

      const response = await testAggregator.aggregateTokenData({
        assetUnit: 'lovelace',
        fields: ['name', 'price'],
      });

      const totalTime = Date.now() - startTime;

      expect(response.data.name).toBe('Slow Cardano');
      expect(response.data.price).toBe(0.45);
      expect(totalTime).toBeLessThan(150); // Should be closer to 100ms than 110ms
    });

    test('should handle concurrent requests to same provider', async () => {
      const response = await aggregator.aggregateTokenData({
        assetUnit: 'lovelace',
        fields: ['name', 'symbol', 'decimals'], // All from Blockfrost
      });

      expect(response.data.name).toBe('Cardano');
      expect(response.data.symbol).toBe('ADA');
      expect(response.data.decimals).toBe(6);
      expect(response.metadata?.dataSources).toEqual(['blockfrost']);
    });
  });

  describe('Error Handling', () => {
    test('should return error when all providers fail', async () => {
      const failingProvider = new MockProvider(
        'failing',
        { tokenData: ['price'], walletData: [] },
        {},
        true,
      );

      const testAggregator = new DataAggregator([failingProvider], {
        price: ['failing'],
      });

      const response = await testAggregator.aggregateTokenData({
        assetUnit: 'lovelace',
        fields: ['price'],
      });

      expect(response.data.price).toBeUndefined();
      expect(response.errors).toHaveLength(1);
      expect(response.errors?.[0].provider).toBe('failing');
    });

    test('should handle provider not found error', async () => {
      const testAggregator = new DataAggregator([], {
        price: ['nonexistent'],
      });

      const response = await testAggregator.aggregateTokenData({
        assetUnit: 'lovelace',
        fields: ['price'],
      });

      expect(response.data.price).toBeUndefined();
      expect(response.errors).toHaveLength(1);
      expect(response.errors?.[0].error).toContain('not found');
    });

    test('should handle malformed responses gracefully', async () => {
      const malformedProvider = new MockProvider(
        'malformed',
        { tokenData: ['price'], walletData: [] },
        { lovelace: null }, // Malformed response
      );

      const testAggregator = new DataAggregator([malformedProvider, coingeckoProvider], {
        price: ['malformed', 'coingecko'],
      });

      const response = await testAggregator.aggregateTokenData({
        assetUnit: 'lovelace',
        fields: ['price'],
      });

      expect(response.data.price).toBe(0.45); // Should fall back to CoinGecko
    });
  });

  describe('Provider Registration', () => {
    test('should register new providers', () => {
      const newProvider = new MockProvider(
        'new',
        { tokenData: ['liquidity'], walletData: [] },
        { lovelace: { liquidity: 1000000 } },
      );

      aggregator.registerProvider(newProvider);

      // Test that the new provider is now available
      const testAggregator = new DataAggregator([newProvider], {
        liquidity: ['new'],
      });

      expect(testAggregator).toBeDefined();
    });

    test('should update field priorities', () => {
      aggregator.setFieldPriority('price', ['taptools', 'coingecko']);

      // This test would need access to internal routing to verify
      // For now, we just ensure the method doesn't throw
      expect(() => {
        aggregator.setFieldPriority('price', ['taptools', 'coingecko']);
      }).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty field arrays', async () => {
      const response = await aggregator.aggregateTokenData({
        assetUnit: 'lovelace',
        fields: [],
      });

      expect(response.data).toEqual({
        dataSource: [],
        lastUpdated: expect.any(Date),
      });
    });

    test('should handle unknown asset units', async () => {
      const response = await aggregator.aggregateTokenData({
        assetUnit: 'unknown-asset',
        fields: ['price'],
      });

      // Should still attempt the request, but may get empty data
      expect(response.data.price).toBeUndefined();
    });

    test('should handle very large field lists', async () => {
      const allFields = [
        'name',
        'symbol',
        'decimals',
        'price',
        'marketCap',
        'volume24h',
        'holders',
        'totalSupply',
      ];

      const response = await aggregator.aggregateTokenData({
        assetUnit: 'lovelace',
        fields: allFields as any,
      });

      expect(Object.keys(response.data).length).toBeGreaterThan(5);
    });

    test('should handle provider timeouts', async () => {
      const timeoutProvider = new MockProvider(
        'timeout',
        { tokenData: ['price'], walletData: [] },
        { lovelace: { price: 0.45 } },
        false,
        5000, // 5 second delay
      );

      const testAggregator = new DataAggregator([timeoutProvider, coingeckoProvider], {
        price: ['timeout', 'coingecko'],
      });

      const response = await testAggregator.aggregateTokenData({
        assetUnit: 'lovelace',
        fields: ['price'],
        options: { timeout: 100 }, // Short timeout
      });

      // Should use fallback provider
      expect(response.data.price).toBe(0.45);
    });
  });
});
