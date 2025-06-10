/**
 * Unit test suite entry point and basic module loading tests
 */

describe('Module Loading', () => {
  test('should import main SDK without errors', async () => {
    expect(() => {
      const { CardalabsSDK } = require('../../src/index');
      expect(CardalabsSDK).toBeDefined();
    }).not.toThrow();
  });

  test('should import all main types without errors', async () => {
    expect(() => {
      const types = require('../../src/types/common');
      expect(types).toBeDefined();
    }).not.toThrow();
  });

  test('should import providers without errors', async () => {
    expect(() => {
      const { BlockfrostProvider } = require('../../src/providers/blockfrost');
      const { CoinGeckoProvider } = require('../../src/providers/coingecko');
      expect(BlockfrostProvider).toBeDefined();
      expect(CoinGeckoProvider).toBeDefined();
    }).not.toThrow();
  });

  test('should import cache modules without errors', async () => {
    expect(() => {
      const { MemoryCache } = require('../../src/sdk/cache/memory-cache');
      const { DefaultCacheKeyBuilder } = require('../../src/sdk/cache/cache-key-builder');
      expect(MemoryCache).toBeDefined();
      expect(DefaultCacheKeyBuilder).toBeDefined();
    }).not.toThrow();
  });

  test('should import aggregator modules without errors', async () => {
    expect(() => {
      const { DataAggregator } = require('../../src/sdk/aggregator/data-aggregator');
      const { FieldRouter } = require('../../src/sdk/aggregator/field-router');
      expect(DataAggregator).toBeDefined();
      expect(FieldRouter).toBeDefined();
    }).not.toThrow();
  });

  test('should import utils without errors', async () => {
    expect(() => {
      const { HTTPClient } = require('../../src/utils/http-client');
      expect(HTTPClient).toBeDefined();
    }).not.toThrow();
  });
});
