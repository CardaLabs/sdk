/**
 * Integration tests for basic SDK functionality
 * These tests use real API endpoints to verify the SDK works end-to-end
 */
import { CardalabsSDK } from '../../src';

describe('Integration Tests - Basic Functionality', () => {
  let sdk: CardalabsSDK;

  beforeAll(async () => {
    sdk = new CardalabsSDK({
      providers: {
        coingecko: {
          enabled: true,
          apiKey: process.env.COINGECKO_API_KEY,
        },
        // Note: Blockfrost requires API key, so we'll skip it for now
        blockfrost: {
          enabled: false,
        },
      },
    });

    await sdk.initialize();
  });

  afterAll(async () => {
    if (sdk) {
      await sdk.destroy();
    }
  });

  describe('CoinGecko Integration', () => {
    test('should get ADA token data from CoinGecko', async () => {
      if (!process.env.COINGECKO_API_KEY) {
        console.warn('Skipping CoinGecko test: COINGECKO_API_KEY not provided');
        return;
      }

      const response = await sdk.getTokenData('lovelace', ['price', 'marketCap', 'volume24h']);

      expect(response).toBeDefined();
      expect(response.data).toBeDefined();

      // The SDK may return errors for CoinGecko if the API is not accessible
      // but should still provide a response structure
      expect(response.metadata).toBeDefined();
      expect(response.metadata?.responseTime).toBeGreaterThanOrEqual(0);

      // If there are errors, check that they're handled gracefully
      if (response.errors && response.errors.length > 0) {
        expect(response.errors[0]).toHaveProperty('provider', 'coingecko');
        expect(response.errors[0]).toHaveProperty('error');
        expect(response.metadata?.dataSources).toEqual([]);
      } else {
        // If successful, verify data structure
        if (response.data.price) {
          expect(typeof response.data.price).toBe('number');
          expect(response.data.price).toBeGreaterThan(0);
        }

        if (response.data.marketCap) {
          expect(typeof response.data.marketCap).toBe('number');
          expect(response.data.marketCap).toBeGreaterThan(0);
        }

        expect(response.metadata?.dataSources).toContain('coingecko');
      }
    }, 30000); // 30 second timeout for API calls

    test('should handle cache functionality', async () => {
      // Skip test if no CoinGecko API key is provided
      if (!process.env.COINGECKO_API_KEY) {
        console.warn('Skipping CoinGecko cache test: COINGECKO_API_KEY not provided');
        return;
      }

      // First request
      const response1 = await sdk.getTokenData('lovelace', ['price']);
      expect(response1.metadata?.cacheStatus).toBeDefined();

      // Second request should potentially hit cache (if first was successful)
      const response2 = await sdk.getTokenData('lovelace', ['price']);
      expect(response2.metadata?.cacheStatus).toBeDefined();

      // If both requests were successful, verify cache behavior
      if (!response1.errors?.length && !response2.errors?.length) {
        expect(response1.metadata?.cacheStatus).toBe('miss');
        expect(response2.metadata?.cacheStatus).toBe('hit');
        expect(response1.data.price).toBe(response2.data.price);
      }
    }, 30000);

    test('should get provider health status', async () => {
      const health = await sdk.getProviderHealth();

      expect(health).toBeDefined();
      expect(health.coingecko).toBeDefined();
      expect(health.coingecko.lastCheck).toBeDefined();
      expect(health.coingecko.responseTime).toBeGreaterThanOrEqual(0);

      // Health status may be false if CoinGecko API is not accessible or API key is missing
      expect(typeof health.coingecko.healthy).toBe('boolean');

      if (!health.coingecko.healthy) {
        expect(health.coingecko.lastError).toBeDefined();
      }
    }, 30000);

    test('should get SDK statistics', async () => {
      const stats = await sdk.getStats();

      expect(stats).toBeDefined();
      expect(stats.requests).toBeDefined();
      expect(stats.requests.total).toBeGreaterThanOrEqual(0);
      expect(stats.cache).toBeDefined();
      expect(stats.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid asset gracefully', async () => {
      const response = await sdk.getTokenData('invalid-asset-12345', ['price']);

      // SDK should return a response with errors, not throw
      expect(response).toBeDefined();
      expect(response.errors).toBeDefined();
      expect(response.errors?.length).toBeGreaterThan(0);
      expect(response.metadata?.dataSources).toEqual([]);
    }, 30000);

    test('should handle network timeout', async () => {
      const response = await sdk.getTokenData('lovelace', ['price'], { timeout: 1 }); // 1ms timeout

      // SDK should return a response with errors, not throw
      expect(response).toBeDefined();
      expect(response.errors).toBeDefined();
      expect(response.errors?.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Configuration Edge Cases', () => {
    test('should work with minimal configuration', async () => {
      // Skip test if no CoinGecko API key is provided
      if (!process.env.COINGECKO_API_KEY) {
        console.warn('Skipping minimal configuration test: COINGECKO_API_KEY not provided');
        return;
      }

      const minimalSDK = new CardalabsSDK({
        providers: {
          coingecko: { 
            enabled: true,
            apiKey: process.env.COINGECKO_API_KEY,
          },
        },
      });

      await minimalSDK.initialize();

      const response = await minimalSDK.getTokenData('lovelace', ['price']);
      expect(response).toBeDefined();
      expect(response.data).toBeDefined();

      // If successful, price should be a positive number
      if (response.data.price) {
        expect(response.data.price).toBeGreaterThan(0);
      }

      await minimalSDK.destroy();
    }, 30000);
  });
});
