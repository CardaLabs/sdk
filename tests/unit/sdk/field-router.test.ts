/**
 * Unit tests for FieldRouter
 */
import type { DataProvider } from '../../../src/providers/base/provider.interface';
import { FieldRouter } from '../../../src/sdk/aggregator/field-router';
import type { ProviderCapabilities } from '../../../src/types/sdk';

// Mock provider for testing
class MockProvider implements Partial<DataProvider> {
  constructor(
    public readonly name: string,
    public readonly capabilities: ProviderCapabilities,
  ) {}

  async initialize() {
    return Promise.resolve();
  }
  async destroy() {
    return Promise.resolve();
  }
  async healthCheck() {
    return {
      provider: this.name,
      healthy: true,
      lastCheck: new Date(),
      consecutiveFailures: 0,
    };
  }
  async getTokenData() {
    return Promise.resolve({ success: true, provider: this.name, timestamp: new Date() });
  }
  async getWalletData() {
    return Promise.resolve({ success: true, provider: this.name, timestamp: new Date() });
  }
}

describe('FieldRouter', () => {
  let router: FieldRouter;
  let blockfrostProvider: MockProvider;
  let coingeckoProvider: MockProvider;
  let taptoolsProvider: MockProvider;

  beforeEach(() => {
    // Create mock providers with different capabilities
    blockfrostProvider = new MockProvider('blockfrost', {
      tokenData: ['name', 'symbol', 'decimals', 'totalSupply', 'description'],
      walletData: ['balance', 'transactions'],
      features: {
        batch: false,
        realtime: false,
        historical: true,
      },
      rateLimit: {
        requestsPerSecond: 10,
        requestsPerDay: 100000,
      },
    });

    coingeckoProvider = new MockProvider('coingecko', {
      tokenData: [
        'price',
        'priceUsd',
        'marketCap',
        'volume24h',
        'priceChange24h',
        'priceChangePercentage24h',
        'high24h',
        'low24h',
        'ath',
        'atl',
      ],
      walletData: [],
      features: {
        batch: true,
        realtime: false,
        historical: true,
      },
      rateLimit: {
        requestsPerMinute: 50,
      },
    });

    taptoolsProvider = new MockProvider('taptools', {
      tokenData: ['holders', 'price', 'marketCap'],
      walletData: ['portfolio', 'balance'],
      features: {
        batch: false,
        realtime: true,
        historical: false,
      },
      rateLimit: {
        requestsPerSecond: 5,
      },
    });

    router = new FieldRouter(
      [blockfrostProvider, coingeckoProvider, taptoolsProvider] as DataProvider[],
      {
        price: ['coingecko', 'taptools'],
        name: ['blockfrost'],
        balance: ['blockfrost', 'taptools'],
        portfolio: ['taptools'],
      },
    );
  });

  describe('Provider Registration', () => {
    test('should register providers correctly', () => {
      const newRouter = new FieldRouter();
      newRouter.registerProvider(blockfrostProvider as DataProvider);

      const providers = newRouter.getProvidersForTokenField('name');
      expect(providers).toContain('blockfrost');
    });

    test('should unregister providers', () => {
      const newRouter = new FieldRouter();
      newRouter.registerProvider(coingeckoProvider as DataProvider);
      newRouter.unregisterProvider('coingecko');

      const providers = newRouter.getProvidersForTokenField('price');
      expect(providers).not.toContain('coingecko');
    });
  });

  describe('Provider Capability Mapping', () => {
    test('should get providers for token fields', () => {
      expect(router.getProvidersForTokenField('price')).toEqual(['coingecko', 'taptools']);
      expect(router.getProvidersForTokenField('name')).toEqual(['blockfrost']);
      expect(router.getProvidersForTokenField('volume24h')).toEqual(['coingecko']);
      expect(router.getProvidersForTokenField('holders')).toEqual(['taptools']);
    });

    test('should get providers for wallet fields', () => {
      expect(router.getProvidersForWalletField('balance')).toEqual(['blockfrost', 'taptools']);
      expect(router.getProvidersForWalletField('transactions')).toEqual(['blockfrost']);
      expect(router.getProvidersForWalletField('portfolio')).toEqual(['taptools']);
    });

    test('should return empty array for unsupported fields', () => {
      expect(router.getProvidersForTokenField('unsupportedField' as any)).toEqual([]);
      expect(router.getProvidersForWalletField('unsupportedField' as any)).toEqual([]);
    });
  });

  describe('Routing Plan Creation', () => {
    test('should create routing plan for token data', () => {
      const plan = router.planTokenDataRouting(['price', 'name', 'volume24h']);

      expect(plan.size).toBe(3);
      expect(plan.get('price')?.provider).toBe('coingecko'); // First in priority
      expect(plan.get('name')?.provider).toBe('blockfrost');
      expect(plan.get('volume24h')?.provider).toBe('coingecko');
    });

    test('should create routing plan for wallet data', () => {
      const plan = router.planWalletDataRouting(['balance', 'portfolio']);

      expect(plan.size).toBe(2);
      expect(plan.get('balance')?.provider).toBe('blockfrost'); // First in priority
      expect(plan.get('portfolio')?.provider).toBe('taptools');
    });

    test('should include fallback providers in routing plan', () => {
      const plan = router.planTokenDataRouting(['price']);
      const pricePlan = plan.get('price');

      expect(pricePlan?.provider).toBe('coingecko');
      expect(pricePlan?.fallbackProviders).toContain('taptools');
    });

    test('should skip fields with no available providers', () => {
      const plan = router.planTokenDataRouting(['price', 'unsupportedField' as any]);

      expect(plan.size).toBe(1);
      expect(plan.has('price')).toBe(true);
      expect(plan.has('unsupportedField')).toBe(false);
    });
  });

  describe('Provider Selection Strategies', () => {
    test('should select provider by priority', () => {
      router.setFieldPriority('price', ['taptools', 'coingecko']);

      const provider = router.getOptimalProvider('price', ['coingecko', 'taptools'], 'priority');
      expect(provider).toBe('taptools');
    });

    test('should select fastest provider', () => {
      // Set up metrics to make taptools faster
      router.updateMetrics('coingecko', 1000, true);
      router.updateMetrics('taptools', 500, true);

      const provider = router.getOptimalProvider('price', ['coingecko', 'taptools'], 'fastest');
      expect(provider).toBe('taptools');
    });

    test('should select most reliable provider', () => {
      // Set up metrics to make coingecko more reliable
      router.updateMetrics('coingecko', 1000, true);
      router.updateMetrics('coingecko', 1000, true);
      router.updateMetrics('taptools', 500, true);
      router.updateMetrics('taptools', 500, false); // One failure

      const provider = router.getOptimalProvider('price', ['coingecko', 'taptools'], 'reliability');
      expect(provider).toBe('coingecko');
    });

    test('should fall back to first provider when no priorities set', () => {
      const provider = router.getOptimalProvider(
        'newField',
        ['provider1', 'provider2'],
        'priority',
      );
      expect(provider).toBe('provider1');
    });

    test('should return null for empty provider list', () => {
      const provider = router.getOptimalProvider('price', [], 'priority');
      expect(provider).toBeNull();
    });

    test('should return single provider directly', () => {
      const provider = router.getOptimalProvider('price', ['coingecko'], 'priority');
      expect(provider).toBe('coingecko');
    });
  });

  describe('Metrics Tracking', () => {
    test('should update provider metrics', () => {
      router.updateMetrics('coingecko', 1500, true);
      router.updateMetrics('coingecko', 1200, false);

      const metrics = router.getProviderMetrics('coingecko');
      expect(metrics).toBeDefined();
      expect(metrics?.totalRequests).toBe(2);
      expect(metrics?.failedRequests).toBe(1);
      expect(metrics?.successRate).toBe(0.5);
      expect(metrics?.avgResponseTime).toBeLessThan(1500); // Should be weighted average
    });

    test('should track response time with moving average', () => {
      router.updateMetrics('coingecko', 1000, true);
      router.updateMetrics('coingecko', 2000, true);

      const metrics = router.getProviderMetrics('coingecko');
      expect(metrics?.avgResponseTime).toBeGreaterThan(1000);
      expect(metrics?.avgResponseTime).toBeLessThan(2000);
    });

    test('should get all provider metrics', () => {
      router.updateMetrics('coingecko', 1000, true);
      router.updateMetrics('blockfrost', 1500, true);

      const allMetrics = router.getAllMetrics();
      expect(allMetrics.size).toBeGreaterThanOrEqual(2);
      expect(allMetrics.has('coingecko')).toBe(true);
      expect(allMetrics.has('blockfrost')).toBe(true);
    });

    test('should ignore metrics update for unknown provider', () => {
      router.updateMetrics('unknown-provider', 1000, true);

      const metrics = router.getProviderMetrics('unknown-provider');
      expect(metrics).toBeUndefined();
    });
  });

  describe('Field Priority Configuration', () => {
    test('should set and use field priorities', () => {
      router.setFieldPriority('price', ['taptools', 'coingecko']);

      const plan = router.planTokenDataRouting(['price']);
      expect(plan.get('price')?.provider).toBe('taptools');
    });

    test('should override existing priorities', () => {
      // Initial priority: coingecko first
      expect(router.getOptimalProvider('price', ['coingecko', 'taptools'], 'priority')).toBe(
        'coingecko',
      );

      // Change priority: taptools first
      router.setFieldPriority('price', ['taptools', 'coingecko']);
      expect(router.getOptimalProvider('price', ['coingecko', 'taptools'], 'priority')).toBe(
        'taptools',
      );
    });

    test('should handle priorities with unavailable providers', () => {
      router.setFieldPriority('price', ['unavailable-provider', 'coingecko', 'taptools']);

      const provider = router.getOptimalProvider('price', ['coingecko', 'taptools'], 'priority');
      expect(provider).toBe('coingecko'); // Should skip unavailable and use next
    });
  });

  describe('Routing Plan Estimation', () => {
    test('should include estimated response time in routing plan', () => {
      router.updateMetrics('coingecko', 1500, true);

      const plan = router.planTokenDataRouting(['price']);
      const pricePlan = plan.get('price');

      expect(pricePlan?.estimated.responseTime).toBeDefined();
      expect(pricePlan?.estimated.successRate).toBeDefined();
    });

    test('should use default estimates for providers without metrics', () => {
      const plan = router.planTokenDataRouting(['name']);
      const namePlan = plan.get('name');

      expect(namePlan?.estimated.responseTime).toBe(1000); // Default
      expect(namePlan?.estimated.successRate).toBe(1.0); // Default
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty provider list during initialization', () => {
      const emptyRouter = new FieldRouter([], {});

      const plan = emptyRouter.planTokenDataRouting(['price']);
      expect(plan.size).toBe(0);
    });

    test('should handle provider with empty capabilities', () => {
      const emptyProvider = new MockProvider('empty', {
        tokenData: [],
        walletData: [],
      });

      const testRouter = new FieldRouter([emptyProvider] as DataProvider[]);

      const providers = testRouter.getProvidersForTokenField('price');
      expect(providers).toEqual([]);
    });

    test('should handle undefined capabilities gracefully', () => {
      const undefinedProvider = new MockProvider('undefined', {});

      const testRouter = new FieldRouter([undefinedProvider] as DataProvider[]);

      const providers = testRouter.getProvidersForTokenField('price');
      expect(providers).toEqual([]);
    });

    test('should handle concurrent metrics updates', async () => {
      const promises = [];

      for (let i = 0; i < 100; i++) {
        promises.push(
          Promise.resolve().then(() => {
            router.updateMetrics('coingecko', Math.random() * 1000, Math.random() > 0.5);
          }),
        );
      }

      await Promise.all(promises);

      const metrics = router.getProviderMetrics('coingecko');
      expect(metrics?.totalRequests).toBe(100);
    });
  });
});
