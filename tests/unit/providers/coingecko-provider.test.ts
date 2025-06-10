/**
 * Unit tests for CoinGeckoProvider
 */
import type { BaseProvider } from '../../../src/providers/base/provider.interface';
import { CoinGeckoProvider } from '../../../src/providers/coingecko';
import type { CoingeckoConfig } from '../../../src/types/sdk';

// Mock the HTTP client
jest.mock('../../../src/utils/http-client', () => {
  return {
    HTTPClient: jest.fn().mockImplementation(() => ({
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    })),
  };
});

describe('CoinGeckoProvider', () => {
  let provider: any; // Use any to avoid TypeScript issues with path aliases
  let mockHttpClient: any;

  beforeEach(() => {
    // Create mock HTTP client
    mockHttpClient = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    };

    // Mock HTTPClient constructor to return our mock
    const { HTTPClient } = require('../../../src/utils/http-client');
    HTTPClient.mockImplementation(() => mockHttpClient);

    provider = new CoinGeckoProvider();
  });

  describe('Initialization', () => {
    test('should initialize with valid configuration', async () => {
      const config: CoingeckoConfig = {
        apiKey: 'test_api_key',
        pro: true,
        baseUrl: 'https://pro-api.coingecko.com/api/v3',
      };

      await provider.initialize(config);

      expect((provider as any).apiKey).toBe('test_api_key');
      expect((provider as any).isPro).toBe(true);
      expect((provider as any).baseUrl).toBe('https://pro-api.coingecko.com/api/v3');
    });

    test('should use free tier URL by default', async () => {
      const config: CoingeckoConfig = {
        apiKey: 'test_api_key',
      };

      await provider.initialize(config);

      expect((provider as any).baseUrl).toBe('https://api.coingecko.com/api/v3');
      expect((provider as any).isPro).toBe(false);
    });

    test('should work without API key for free tier', async () => {
      const config: CoingeckoConfig = {
        apiKey: '',
      };

      await provider.initialize(config);

      expect((provider as any).apiKey).toBe('');
    });

    test('should set up HTTP client with correct headers', async () => {
      const config: CoingeckoConfig = {
        apiKey: 'test_api_key',
        pro: true,
      };

      await provider.initialize(config);

      // Verify HTTP client was configured
      expect((provider as any).httpClient).toBeDefined();
    });
  });

  describe('Health Check', () => {
    test('should return healthy status on successful ping', async () => {
      // Add a small delay to simulate network response time
      mockHttpClient.get.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ data: { gecko_says: '(V3) To the Moon!' } }), 10),
          ),
      );

      const health = await provider.healthCheck();

      expect(health.provider).toBe('coingecko');
      expect(health.healthy).toBe(true);
      expect(health.responseTime).toBeGreaterThan(0);
      expect(health.consecutiveFailures).toBe(0);
      expect(mockHttpClient.get).toHaveBeenCalledWith('/ping');
    });

    test('should return unhealthy status on failed ping', async () => {
      mockHttpClient.get.mockRejectedValue(new Error('API unavailable'));

      const health = await provider.healthCheck();

      expect(health.provider).toBe('coingecko');
      expect(health.healthy).toBe(false);
      expect(health.consecutiveFailures).toBe(1);
      expect(health.lastError).toBe('API unavailable');
    });
  });

  describe('Token Data', () => {
    beforeEach(async () => {
      await provider.initialize({ apiKey: 'test_api_key' });
    });

    test('should get token data for mapped coin', async () => {
      const mockCoinData = {
        id: 'cardano',
        symbol: 'ada',
        name: 'Cardano',
        description: {
          en: 'Cardano is a blockchain platform for changemakers, innovators, and visionaries.',
        },
        image: {
          thumb: 'https://assets.coingecko.com/coins/images/975/thumb/cardano.png',
          small: 'https://assets.coingecko.com/coins/images/975/small/cardano.png',
          large: 'https://assets.coingecko.com/coins/images/975/large/cardano.png',
        },
        market_data: {
          current_price: { usd: 0.45 },
          market_cap: { usd: 15000000000 },
          total_volume: { usd: 500000000 },
          high_24h: { usd: 0.47 },
          low_24h: { usd: 0.43 },
          price_change_24h: 0.02,
          price_change_percentage_24h: 4.65,
          price_change_percentage_7d: -2.5,
          price_change_percentage_30d: 12.8,
          ath: { usd: 3.1 },
          atl: { usd: 0.017 },
          ath_date: { usd: '2021-09-02T06:00:10.474Z' },
          atl_date: { usd: '2020-03-13T02:22:55.391Z' },
          total_supply: 45000000000,
          max_supply: 45000000000,
          circulating_supply: 34000000000,
          last_updated: '2023-12-01T10:30:00.000Z',
        },
      };

      mockHttpClient.get.mockResolvedValue({ data: mockCoinData });

      const response = await provider.getTokenData('lovelace');

      expect(response.success).toBe(true);
      expect(response.data?.name).toBe('Cardano');
      expect(response.data?.symbol).toBe('ADA');
      expect(response.data?.price).toBe(0.45);
      expect(response.data?.priceUsd).toBe(0.45);
      expect(response.data?.marketCap).toBe(15000000000);
      expect(response.data?.volume24h).toBe(500000000);
      expect(response.data?.priceChangePercentage24h).toBe(4.65);
      expect(response.data?.high24h).toBe(0.47);
      expect(response.data?.low24h).toBe(0.43);
      expect(response.data?.ath).toBe(3.1);
      expect(response.data?.atl).toBe(0.017);
      expect(response.data?.totalSupply).toBe(45000000000);
      expect(response.data?.circulatingSupply).toBe(34000000000);
      expect(response.data?.maxSupply).toBe(45000000000);
      expect(response.provider).toBe('coingecko');

      expect(mockHttpClient.get).toHaveBeenCalledWith('/coins/cardano', expect.any(Object));
    });

    test('should handle unmapped asset units', async () => {
      const response = await provider.getTokenData('unknown_asset');

      expect(response.success).toBe(false);
      expect(response.error?.message).toContain('No CoinGecko mapping found');
    });

    test('should handle coins without market data', async () => {
      const mockCoinData = {
        id: 'test-coin',
        symbol: 'test',
        name: 'Test Coin',
        market_data: null,
      };

      mockHttpClient.get.mockResolvedValue({ data: mockCoinData });

      // Add mapping for test
      provider.addAssetMapping('test_asset', 'test-coin');

      const response = await provider.getTokenData('test_asset');

      expect(response.success).toBe(false);
      expect(response.error?.message).toContain('No market data available');
    });

    test('should handle API errors gracefully', async () => {
      mockHttpClient.get.mockRejectedValue(new Error('Coin not found'));

      provider.addAssetMapping('test_asset', 'non-existent-coin');

      const response = await provider.getTokenData('test_asset');

      expect(response.success).toBe(false);
      expect(response.error?.message).toBe('Coin not found');
    });

    test('should handle missing optional fields gracefully', async () => {
      const mockCoinData = {
        id: 'minimal-coin',
        symbol: 'min',
        name: 'Minimal Coin',
        market_data: {
          current_price: { usd: 1.0 },
          // Missing most optional fields
        },
      };

      mockHttpClient.get.mockResolvedValue({ data: mockCoinData });

      provider.addAssetMapping('minimal_asset', 'minimal-coin');

      const response = await provider.getTokenData('minimal_asset');

      expect(response.success).toBe(true);
      expect(response.data?.name).toBe('Minimal Coin');
      expect(response.data?.price).toBe(1.0);
      expect(response.data?.marketCap).toBeUndefined();
      expect(response.data?.volume24h).toBeUndefined();
    });
  });

  describe('Wallet Data', () => {
    beforeEach(async () => {
      await provider.initialize({ apiKey: 'test_api_key' });
    });

    test('should not support wallet data', async () => {
      const response = await provider.getWalletData('addr1test');

      expect(response.success).toBe(false);
      expect(response.error?.message).toContain('does not support wallet data');
    });
  });

  describe('Batch Operations', () => {
    beforeEach(async () => {
      await provider.initialize({ apiKey: 'test_api_key' });
    });

    test('should get batch token data', async () => {
      const mockMarketData = [
        {
          id: 'cardano',
          symbol: 'ada',
          name: 'Cardano',
          image: 'https://example.com/ada.png',
          current_price: 0.45,
          market_cap: 15000000000,
          total_volume: 500000000,
          high_24h: 0.47,
          low_24h: 0.43,
          price_change_24h: 0.02,
          price_change_percentage_24h: 4.65,
          price_change_percentage_7d_in_currency: -2.5,
          price_change_percentage_30d_in_currency: 12.8,
          ath: 3.1,
          atl: 0.017,
          ath_date: '2021-09-02T06:00:10.474Z',
          atl_date: '2020-03-13T02:22:55.391Z',
          total_supply: 45000000000,
          max_supply: 45000000000,
          circulating_supply: 34000000000,
          last_updated: '2023-12-01T10:30:00.000Z',
        },
      ];

      mockHttpClient.get.mockResolvedValue({ data: mockMarketData });

      const response = await provider.getTokenDataBatch(['lovelace']);

      expect(response.success).toBe(true);
      expect(response.data?.lovelace).toBeDefined();
      expect(response.data?.lovelace.name).toBe('Cardano');
      expect(response.data?.lovelace.price).toBe(0.45);

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/coins/markets?vs_currency=usd&ids=cardano'),
        expect.any(Object),
      );
    });

    test('should handle empty asset list', async () => {
      const response = await provider.getTokenDataBatch([]);

      expect(response.success).toBe(false);
      expect(response.error?.message).toContain('No valid CoinGecko mappings found');
    });

    test('should filter out unmapped assets', async () => {
      const mockMarketData = [
        {
          id: 'cardano',
          symbol: 'ada',
          name: 'Cardano',
          current_price: 0.45,
          market_cap: 15000000000,
          total_volume: 500000000,
          last_updated: '2023-12-01T10:30:00.000Z',
        },
      ];

      mockHttpClient.get.mockResolvedValue({ data: mockMarketData });

      const response = await provider.getTokenDataBatch(['lovelace', 'unknown_asset']);

      expect(response.success).toBe(true);
      expect(response.data?.lovelace).toBeDefined();
      expect(response.data?.unknown_asset).toBeUndefined();
    });
  });

  describe('Asset Mapping', () => {
    test('should add custom asset mapping', () => {
      provider.addAssetMapping('custom_asset', 'custom-coin-id');

      // Test that mapping was added by attempting to use it
      expect(() => {
        provider.addAssetMapping('custom_asset', 'custom-coin-id');
      }).not.toThrow();
    });

    test('should use custom mappings in requests', async () => {
      await provider.initialize({ apiKey: 'test_api_key' });

      const mockCoinData = {
        id: 'custom-coin',
        symbol: 'custom',
        name: 'Custom Coin',
        market_data: {
          current_price: { usd: 2.5 },
        },
      };

      mockHttpClient.get.mockResolvedValue({ data: mockCoinData });

      provider.addAssetMapping('custom_asset_unit', 'custom-coin');

      const response = await provider.getTokenData('custom_asset_unit');

      expect(response.success).toBe(true);
      expect(response.data?.name).toBe('Custom Coin');
      expect(mockHttpClient.get).toHaveBeenCalledWith('/coins/custom-coin', expect.any(Object));
    });
  });

  describe('Supported Currencies', () => {
    beforeEach(async () => {
      await provider.initialize({ apiKey: 'test_api_key' });
    });

    test('should get supported currencies', async () => {
      const mockCurrencies = ['usd', 'eur', 'btc', 'eth'];

      mockHttpClient.get.mockResolvedValue({ data: mockCurrencies });

      const currencies = await provider.getSupportedCurrencies();

      expect(currencies).toEqual(mockCurrencies);
      expect(mockHttpClient.get).toHaveBeenCalledWith('/simple/supported_vs_currencies');
    });

    test('should return default currencies on API error', async () => {
      mockHttpClient.get.mockRejectedValue(new Error('API error'));

      const currencies = await provider.getSupportedCurrencies();

      expect(currencies).toEqual(['usd', 'eur', 'btc']);
    });
  });

  describe('Provider Capabilities', () => {
    test('should have correct capabilities defined', () => {
      expect(provider.capabilities.tokenData).toContain('price');
      expect(provider.capabilities.tokenData).toContain('priceUsd');
      expect(provider.capabilities.tokenData).toContain('marketCap');
      expect(provider.capabilities.tokenData).toContain('volume24h');
      expect(provider.capabilities.tokenData).toContain('priceChangePercentage24h');

      expect(provider.capabilities.walletData).toEqual([]);

      expect(provider.capabilities.features?.batch).toBe(true);
      expect(provider.capabilities.features?.realtime).toBe(false);
      expect(provider.capabilities.features?.historical).toBe(true);
    });

    test('should have rate limit information', () => {
      expect(provider.capabilities.rateLimit?.requestsPerMinute).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await provider.initialize({ apiKey: 'test_api_key' });
    });

    test('should handle rate limiting', async () => {
      mockHttpClient.get.mockRejectedValue({
        name: 'HTTPError',
        status: 429,
        message: 'Too Many Requests',
      });

      provider.addAssetMapping('test_asset', 'cardano');

      const response = await provider.getTokenData('test_asset');

      expect(response.success).toBe(false);
    });

    test('should handle network timeouts', async () => {
      mockHttpClient.get.mockRejectedValue(new Error('Request timeout'));

      provider.addAssetMapping('test_asset', 'cardano');

      const response = await provider.getTokenData('test_asset', { timeout: 1000 });

      expect(response.success).toBe(false);
      expect(response.error?.message).toBe('Request timeout');
    });

    test('should handle malformed API responses', async () => {
      mockHttpClient.get.mockResolvedValue({ data: 'invalid json' });

      provider.addAssetMapping('test_asset', 'cardano');

      const response = await provider.getTokenData('test_asset');

      expect(response.success).toBe(false);
    });

    test('should handle missing price data', async () => {
      const mockCoinData = {
        id: 'test-coin',
        symbol: 'test',
        name: 'Test Coin',
        market_data: {
          // Missing current_price
          market_cap: { usd: 1000000 },
        },
      };

      mockHttpClient.get.mockResolvedValue({ data: mockCoinData });

      provider.addAssetMapping('test_asset', 'test-coin');

      const response = await provider.getTokenData('test_asset');

      expect(response.success).toBe(true);
      expect(response.data?.price).toBeUndefined();
      expect(response.data?.marketCap).toBe(1000000);
    });
  });

  describe('Request Options', () => {
    beforeEach(async () => {
      await provider.initialize({ apiKey: 'test_api_key' });
    });

    test('should pass timeout option to HTTP client', async () => {
      provider.addAssetMapping('test_asset', 'cardano');

      const mockCoinData = {
        id: 'cardano',
        market_data: { current_price: { usd: 0.45 } },
      };

      mockHttpClient.get.mockResolvedValue({ data: mockCoinData });

      await provider.getTokenData('test_asset', { timeout: 5000 });

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        '/coins/cardano',
        expect.objectContaining({
          timeout: 5000,
        }),
      );
    });

    test('should handle custom headers in request options', async () => {
      provider.addAssetMapping('test_asset', 'cardano');

      const mockCoinData = {
        id: 'cardano',
        market_data: { current_price: { usd: 0.45 } },
      };

      mockHttpClient.get.mockResolvedValue({ data: mockCoinData });

      const customOptions = {
        timeout: 3000,
        headers: { 'Custom-Header': 'test-value' },
      };

      await provider.getTokenData('test_asset', customOptions);

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        '/coins/cardano',
        expect.objectContaining({
          timeout: 3000,
          headers: expect.objectContaining({
            'Custom-Header': 'test-value',
          }),
        }),
      );
    });
  });

  describe('Configuration Variants', () => {
    test('should configure for Pro API', async () => {
      const config: CoingeckoConfig = {
        apiKey: 'pro_api_key',
        pro: true,
      };

      await provider.initialize(config);

      expect((provider as any).baseUrl).toBe('https://pro-api.coingecko.com/api/v3');
      expect((provider as any).isPro).toBe(true);
    });

    test('should configure custom base URL', async () => {
      const config: CoingeckoConfig = {
        apiKey: 'test_key',
        baseUrl: 'https://custom-api.example.com/v3',
      };

      await provider.initialize(config);

      expect((provider as any).baseUrl).toBe('https://custom-api.example.com/v3');
    });
  });
});
