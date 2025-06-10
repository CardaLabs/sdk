/**
 * Unit tests for CardalabsSDK (Main SDK class)
 */
import { CardalabsSDK } from '../../../src/sdk/cardalabs';
import { ConfigurationError } from '../../../src/types/errors';
import type { CardalabsConfig } from '../../../src/types/sdk';

// Mock all dependencies
jest.mock('../../../src/sdk/cache/memory-cache');
jest.mock('../../../src/sdk/aggregator/data-aggregator');
jest.mock('../../../src/providers/blockfrost');
jest.mock('../../../src/providers/coingecko');

describe('CardalabsSDK', () => {
  let sdk: CardalabsSDK;
  let mockConfig: CardalabsConfig;

  beforeEach(() => {
    mockConfig = {
      providers: {
        blockfrost: {
          projectId: 'test_project_id',
          enabled: true,
        },
        coingecko: {
          apiKey: 'test_api_key',
          enabled: true,
        },
      },
      cache: {
        defaultTtl: 300,
        maxSize: 1000,
      },
      defaultRequestOptions: {
        timeout: 10000,
        maxRetries: 3,
      },
    };

    sdk = new CardalabsSDK(mockConfig);
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should create SDK instance with configuration', () => {
      expect(sdk).toBeInstanceOf(CardalabsSDK);

      // The SDK adds default values to the config, so we need to check for the expected structure
      const expectedConfig = {
        ...mockConfig,
        cache: {
          defaultTtl: 300,
          maxSize: 1000,
          autoCleanup: true, // Added by SDK
        },
        defaultRequestOptions: {
          timeout: 10000,
          maxRetries: 3,
          useCache: true, // Added by SDK
        },
      };

      expect((sdk as any).config).toEqual(expectedConfig);
    });

    test('should create SDK with default configuration', () => {
      const defaultSDK = new CardalabsSDK();
      expect(defaultSDK).toBeInstanceOf(CardalabsSDK);
    });

    test('should initialize providers correctly', async () => {
      // Mock provider initialization
      const mockBlockfrostProvider = {
        name: 'blockfrost',
        initialize: jest.fn().mockResolvedValue(undefined),
        capabilities: { tokenData: ['name'], walletData: ['balance'] },
      };

      const mockCoingeckoProvider = {
        name: 'coingecko',
        initialize: jest.fn().mockResolvedValue(undefined),
        capabilities: { tokenData: ['price'], walletData: [] },
      };

      // Mock provider constructors
      const { BlockfrostProvider } = require('../../../src/providers/blockfrost');
      const { CoinGeckoProvider } = require('../../../src/providers/coingecko');

      BlockfrostProvider.mockImplementation(() => mockBlockfrostProvider);
      CoinGeckoProvider.mockImplementation(() => mockCoingeckoProvider);

      await sdk.initialize();

      expect(mockBlockfrostProvider.initialize).toHaveBeenCalledWith(
        mockConfig.providers?.blockfrost,
      );
      expect(mockCoingeckoProvider.initialize).toHaveBeenCalledWith(
        mockConfig.providers?.coingecko,
      );
      expect((sdk as any).initialized).toBe(true);
    });

    test('should throw error when initializing twice', async () => {
      // Mock successful initialization
      const mockProvider = {
        name: 'test',
        initialize: jest.fn().mockResolvedValue(undefined),
        capabilities: { tokenData: [], walletData: [] },
      };

      const { BlockfrostProvider } = require('../../../src/providers/blockfrost');
      BlockfrostProvider.mockImplementation(() => mockProvider);

      await sdk.initialize();

      await expect(sdk.initialize()).rejects.toThrow(ConfigurationError);
      await expect(sdk.initialize()).rejects.toThrow('SDK already initialized');
    });

    test('should throw error when no providers configured', async () => {
      // Create a new SDK with explicitly disabled providers
      const noProviderSDK = new CardalabsSDK({
        providers: {
          blockfrost: { enabled: false },
          coingecko: { enabled: false },
        },
      });

      await expect(noProviderSDK.initialize()).rejects.toThrow(ConfigurationError);
      await expect(noProviderSDK.initialize()).rejects.toThrow(
        'No providers configured or enabled',
      );
    });

    test('should handle provider initialization errors', async () => {
      const failingProvider = {
        name: 'failing',
        initialize: jest.fn().mockRejectedValue(new Error('Init failed')),
        capabilities: { tokenData: [], walletData: [] },
      };

      const { BlockfrostProvider } = require('../../../src/providers/blockfrost');
      BlockfrostProvider.mockImplementation(() => failingProvider);

      await expect(sdk.initialize()).rejects.toThrow(ConfigurationError);
      await expect(sdk.initialize()).rejects.toThrow('Failed to initialize SDK');
    });
  });

  describe('Token Data Retrieval', () => {
    beforeEach(async () => {
      // Mock successful initialization
      const mockProvider = {
        name: 'test',
        initialize: jest.fn().mockResolvedValue(undefined),
        capabilities: { tokenData: ['price'], walletData: [] },
      };

      const { BlockfrostProvider } = require('../../../src/providers/blockfrost');
      BlockfrostProvider.mockImplementation(() => mockProvider);

      // Mock aggregator
      const mockAggregator = {
        aggregateTokenData: jest.fn().mockResolvedValue({
          data: {
            price: 0.45,
            name: 'Cardano',
            dataSource: ['coingecko'],
            lastUpdated: new Date(),
          },
          metadata: {
            dataSources: ['coingecko'],
            responseTime: 150,
            cacheStatus: 'miss',
            timestamp: new Date(),
          },
        }),
      };

      const { DataAggregator } = require('../../../src/sdk/aggregator/data-aggregator');
      DataAggregator.mockImplementation(() => mockAggregator);

      await sdk.initialize();
    });

    test('should get token data successfully', async () => {
      const response = await sdk.getTokenData('lovelace', ['price', 'name']);

      expect(response.data.price).toBe(0.45);
      expect(response.data.name).toBe('Cardano');
      expect(response.metadata?.dataSources).toContain('coingecko');
      expect(response.metadata?.responseTime).toBe(150);
    });

    test('should use default fields when not specified', async () => {
      const response = await sdk.getTokenData('lovelace');

      expect(response).toBeDefined();
      expect(response.data).toBeDefined();
    });

    test('should handle cache hits', async () => {
      // Mock cache hit
      const mockCache = {
        get: jest.fn().mockResolvedValue({
          data: { price: 0.46 },
          metadata: { cacheStatus: 'hit' },
        }),
        set: jest.fn(),
        clear: jest.fn(),
        close: jest.fn(),
      };

      (sdk as any).cache = mockCache;

      const response = await sdk.getTokenData('lovelace', ['price']);

      expect(mockCache.get).toHaveBeenCalled();
      expect(response.data.price).toBe(0.46);
    });

    test('should cache successful responses', async () => {
      const mockCache = {
        get: jest.fn().mockResolvedValue(null), // Cache miss
        set: jest.fn(),
        clear: jest.fn(),
        close: jest.fn(),
      };

      (sdk as any).cache = mockCache;

      await sdk.getTokenData('lovelace', ['price']);

      expect(mockCache.set).toHaveBeenCalled();
    });

    test('should throw error when not initialized', async () => {
      const uninitializedSDK = new CardalabsSDK(mockConfig);

      await expect(uninitializedSDK.getTokenData('lovelace')).rejects.toThrow(ConfigurationError);
      await expect(uninitializedSDK.getTokenData('lovelace')).rejects.toThrow(
        'SDK not initialized',
      );
    });

    test('should handle aggregation errors', async () => {
      // Mock aggregator to throw error
      const mockAggregator = {
        aggregateTokenData: jest.fn().mockRejectedValue(new Error('Aggregation failed')),
      };

      (sdk as any).aggregator = mockAggregator;

      await expect(sdk.getTokenData('lovelace')).rejects.toThrow('Aggregation failed');
    });

    test('should respect request options', async () => {
      const options = {
        useCache: false,
        timeout: 5000,
        preferredProviders: ['coingecko'],
      };

      await sdk.getTokenData('lovelace', ['price'], options);

      // Verify that aggregator was called with correct options
      const mockAggregator = (sdk as any).aggregator;
      expect(mockAggregator.aggregateTokenData).toHaveBeenCalledWith(
        expect.objectContaining({
          assetUnit: 'lovelace',
          fields: ['price'],
          options: expect.objectContaining(options),
        }),
      );
    });
  });

  describe('Wallet Data Retrieval', () => {
    beforeEach(async () => {
      // Mock successful initialization
      const mockProvider = {
        name: 'test',
        initialize: jest.fn().mockResolvedValue(undefined),
        capabilities: { tokenData: [], walletData: ['balance'] },
      };

      const { BlockfrostProvider } = require('../../../src/providers/blockfrost');
      BlockfrostProvider.mockImplementation(() => mockProvider);

      // Mock aggregator
      const mockAggregator = {
        aggregateWalletData: jest.fn().mockResolvedValue({
          data: {
            balance: { lovelace: 1000000000 },
            dataSource: ['blockfrost'],
            lastUpdated: new Date(),
          },
          metadata: {
            dataSources: ['blockfrost'],
            responseTime: 200,
            cacheStatus: 'miss',
            timestamp: new Date(),
          },
        }),
      };

      const { DataAggregator } = require('../../../src/sdk/aggregator/data-aggregator');
      DataAggregator.mockImplementation(() => mockAggregator);

      await sdk.initialize();
    });

    test('should get wallet data successfully', async () => {
      const response = await sdk.getWalletData('addr1test', ['balance']);

      expect(response.data.balance?.lovelace).toBe(1000000000);
      expect(response.metadata?.dataSources).toContain('blockfrost');
    });

    test('should use default fields when not specified', async () => {
      const response = await sdk.getWalletData('addr1test');

      expect(response).toBeDefined();
      expect(response.data).toBeDefined();
    });

    test('should throw error when not initialized', async () => {
      const uninitializedSDK = new CardalabsSDK(mockConfig);

      await expect(uninitializedSDK.getWalletData('addr1test')).rejects.toThrow(ConfigurationError);
    });
  });

  describe('Provider Health Monitoring', () => {
    beforeEach(async () => {
      // Mock providers with health check
      const mockProvider1 = {
        name: 'blockfrost',
        initialize: jest.fn().mockResolvedValue(undefined),
        capabilities: { tokenData: [], walletData: [] },
        healthCheck: jest.fn().mockResolvedValue({
          provider: 'blockfrost',
          healthy: true,
          lastCheck: new Date(),
          consecutiveFailures: 0,
          responseTime: 100,
        }),
      };

      const mockProvider2 = {
        name: 'coingecko',
        initialize: jest.fn().mockResolvedValue(undefined),
        capabilities: { tokenData: [], walletData: [] },
        healthCheck: jest.fn().mockResolvedValue({
          provider: 'coingecko',
          healthy: false,
          lastCheck: new Date(),
          consecutiveFailures: 3,
          lastError: 'Connection timeout',
        }),
      };

      const { BlockfrostProvider } = require('../../../src/providers/blockfrost');
      const { CoinGeckoProvider } = require('../../../src/providers/coingecko');

      BlockfrostProvider.mockImplementation(() => mockProvider1);
      CoinGeckoProvider.mockImplementation(() => mockProvider2);

      await sdk.initialize();
    });

    test('should get provider health status', async () => {
      const health = await sdk.getProviderHealth();

      expect(health.blockfrost).toBeDefined();
      expect(health.blockfrost.healthy).toBe(true);
      expect(health.blockfrost.responseTime).toBe(100);
      expect(health.coingecko).toBeDefined();
      expect(health.coingecko.healthy).toBe(false);
      expect(health.coingecko.lastError).toBe('Connection timeout');
    });

    test('should handle provider health check errors', async () => {
      const failingProvider = {
        name: 'failing',
        initialize: jest.fn().mockResolvedValue(undefined),
        capabilities: { tokenData: [], walletData: [] },
        healthCheck: jest.fn().mockRejectedValue(new Error('Health check failed')),
      };

      (sdk as any).providers.set('failing', failingProvider);

      const health = await sdk.getProviderHealth();

      expect(health.failing.healthy).toBe(false);
      expect(health.failing.lastError).toBe('Health check failed');
    });
  });

  describe('Statistics', () => {
    beforeEach(async () => {
      // Mock initialization
      const mockProvider = {
        name: 'test',
        initialize: jest.fn().mockResolvedValue(undefined),
        capabilities: { tokenData: [], walletData: [] },
      };

      const { BlockfrostProvider } = require('../../../src/providers/blockfrost');
      BlockfrostProvider.mockImplementation(() => mockProvider);

      await sdk.initialize();
    });

    test('should get SDK statistics', async () => {
      // Mock cache stats
      const mockCache = {
        getStats: jest.fn().mockResolvedValue({
          hits: 10,
          misses: 5,
          hitRate: 0.67,
          size: 20,
        }),
        get: jest.fn(),
        set: jest.fn(),
        clear: jest.fn(),
        close: jest.fn(),
      };

      (sdk as any).cache = mockCache;

      // Add a small delay to ensure uptime > 0
      await new Promise((resolve) => setTimeout(resolve, 1));

      const stats = await sdk.getStats();

      expect(stats.requests).toBeDefined();
      expect(stats.cache.hits).toBe(10);
      expect(stats.cache.misses).toBe(5);
      expect(stats.cache.hitRate).toBe(0.67);
      expect(stats.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Event System', () => {
    beforeEach(async () => {
      // Mock initialization
      const mockProvider = {
        name: 'test',
        initialize: jest.fn().mockResolvedValue(undefined),
        capabilities: { tokenData: [], walletData: [] },
      };

      const { BlockfrostProvider } = require('../../../src/providers/blockfrost');
      BlockfrostProvider.mockImplementation(() => mockProvider);

      await sdk.initialize();
    });

    test('should add and remove event listeners', () => {
      const listener = jest.fn();

      sdk.addEventListener('request.complete', listener);
      sdk.removeEventListener('request.complete', listener);

      // Ensure no errors thrown
      expect(listener).not.toHaveBeenCalled();
    });

    test('should emit events during operations', async () => {
      const listener = jest.fn();
      sdk.addEventListener('request.complete', listener);

      // Mock aggregator to simulate successful request
      const mockAggregator = {
        aggregateTokenData: jest.fn().mockResolvedValue({
          data: { price: 0.45 },
          metadata: { dataSources: ['test'], responseTime: 100 },
        }),
      };

      (sdk as any).aggregator = mockAggregator;

      await sdk.getTokenData('lovelace');

      expect(listener).toHaveBeenCalled();
    });
  });

  describe('Cache Management', () => {
    beforeEach(async () => {
      // Mock initialization
      const mockProvider = {
        name: 'test',
        initialize: jest.fn().mockResolvedValue(undefined),
        capabilities: { tokenData: [], walletData: [] },
      };

      const { BlockfrostProvider } = require('../../../src/providers/blockfrost');
      BlockfrostProvider.mockImplementation(() => mockProvider);

      await sdk.initialize();
    });

    test('should clear cache', async () => {
      const mockCache = {
        clear: jest.fn().mockResolvedValue(undefined),
        get: jest.fn(),
        set: jest.fn(),
        close: jest.fn(),
        getStats: jest.fn().mockResolvedValue({}),
      };

      (sdk as any).cache = mockCache;

      await sdk.clearCache();

      expect(mockCache.clear).toHaveBeenCalled();
    });
  });

  describe('Resource Management', () => {
    test('should destroy SDK and cleanup resources', async () => {
      // Mock providers with destroy method
      const mockProvider1 = {
        name: 'provider1',
        initialize: jest.fn().mockResolvedValue(undefined),
        capabilities: { tokenData: [], walletData: [] },
        destroy: jest.fn().mockResolvedValue(undefined),
      };

      const mockProvider2 = {
        name: 'provider2',
        initialize: jest.fn().mockResolvedValue(undefined),
        capabilities: { tokenData: [], walletData: [] },
        destroy: jest.fn().mockResolvedValue(undefined),
      };

      const { BlockfrostProvider } = require('../../../src/providers/blockfrost');
      const { CoinGeckoProvider } = require('../../../src/providers/coingecko');

      BlockfrostProvider.mockImplementation(() => mockProvider1);
      CoinGeckoProvider.mockImplementation(() => mockProvider2);

      // Mock cache
      const mockCache = {
        close: jest.fn().mockResolvedValue(undefined),
        get: jest.fn(),
        set: jest.fn(),
        clear: jest.fn(),
        getStats: jest.fn().mockResolvedValue({}),
      };

      (sdk as any).cache = mockCache;

      await sdk.initialize();
      await sdk.destroy();

      expect(mockProvider1.destroy).toHaveBeenCalled();
      expect(mockProvider2.destroy).toHaveBeenCalled();
      expect(mockCache.close).toHaveBeenCalled();
    });

    test('should handle destroy errors gracefully', async () => {
      // Mock provider that fails to destroy
      const failingProvider = {
        name: 'failing',
        initialize: jest.fn().mockResolvedValue(undefined),
        capabilities: { tokenData: [], walletData: [] },
        destroy: jest.fn().mockRejectedValue(new Error('Destroy failed')),
      };

      const { BlockfrostProvider } = require('../../../src/providers/blockfrost');
      BlockfrostProvider.mockImplementation(() => failingProvider);

      await sdk.initialize();

      // Should not throw even if provider destroy fails
      await expect(sdk.destroy()).resolves.toBeUndefined();
    });
  });

  describe('Configuration Edge Cases', () => {
    test('should handle disabled providers', async () => {
      const configWithDisabled: CardalabsConfig = {
        providers: {
          blockfrost: {
            projectId: 'test',
            enabled: false, // Disabled
          },
          coingecko: {
            apiKey: 'test',
            enabled: true,
          },
        },
      };

      const sdkWithDisabled = new CardalabsSDK(configWithDisabled);

      const mockProvider = {
        name: 'coingecko',
        initialize: jest.fn().mockResolvedValue(undefined),
        capabilities: { tokenData: ['price'], walletData: [] },
      };

      const { CoinGeckoProvider } = require('../../../src/providers/coingecko');
      CoinGeckoProvider.mockImplementation(() => mockProvider);

      await sdkWithDisabled.initialize();

      // Only CoinGecko should be initialized
      expect(mockProvider.initialize).toHaveBeenCalled();
    });

    test('should handle missing API keys gracefully', async () => {
      const configWithMissingKeys: CardalabsConfig = {
        providers: {
          blockfrost: {
            projectId: 'test',
          },
          // CoinGecko missing API key
        },
      };

      const sdkWithMissingKeys = new CardalabsSDK(configWithMissingKeys);

      const mockProvider = {
        name: 'blockfrost',
        initialize: jest.fn().mockResolvedValue(undefined),
        capabilities: { tokenData: ['name'], walletData: ['balance'] },
      };

      const { BlockfrostProvider } = require('../../../src/providers/blockfrost');
      BlockfrostProvider.mockImplementation(() => mockProvider);

      await sdkWithMissingKeys.initialize();

      // Should initialize successfully with only Blockfrost
      expect(mockProvider.initialize).toHaveBeenCalled();
    });
  });
});
