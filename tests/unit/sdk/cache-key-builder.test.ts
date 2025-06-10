/**
 * Unit tests for DefaultCacheKeyBuilder
 */
import {
  DefaultCacheKeyBuilder,
  SimpleCacheKeyBuilder,
} from '../../../src/sdk/cache/cache-key-builder';

describe('DefaultCacheKeyBuilder', () => {
  let keyBuilder: DefaultCacheKeyBuilder;

  beforeEach(() => {
    keyBuilder = new DefaultCacheKeyBuilder();
  });

  describe('Token Data Keys', () => {
    test('should build basic token data key', () => {
      const key = keyBuilder.buildTokenDataKey('lovelace');
      expect(key).toMatch(/^v1:token:lovelace$/);
    });

    test('should build token data key with provider', () => {
      const key = keyBuilder.buildTokenDataKey('lovelace', undefined, 'coingecko');
      expect(key).toMatch(/^v1:token:lovelace:provider:coingecko$/);
    });

    test('should build token data key with fields', () => {
      const key = keyBuilder.buildTokenDataKey('lovelace', ['price', 'marketCap']);
      expect(key).toMatch(/^v1:token:lovelace:fields:[a-f0-9]{8}$/);
    });

    test('should build token data key with provider and fields', () => {
      const key = keyBuilder.buildTokenDataKey('lovelace', ['price', 'marketCap'], 'coingecko');
      expect(key).toMatch(/^v1:token:lovelace:provider:coingecko:fields:[a-f0-9]{8}$/);
    });

    test('should generate same hash for same fields in different order', () => {
      const key1 = keyBuilder.buildTokenDataKey('lovelace', ['price', 'marketCap']);
      const key2 = keyBuilder.buildTokenDataKey('lovelace', ['marketCap', 'price']);
      expect(key1).toBe(key2);
    });

    test('should generate different hash for different fields', () => {
      const key1 = keyBuilder.buildTokenDataKey('lovelace', ['price']);
      const key2 = keyBuilder.buildTokenDataKey('lovelace', ['marketCap']);
      expect(key1).not.toBe(key2);
    });

    test('should sanitize asset unit identifiers', () => {
      const key = keyBuilder.buildTokenDataKey('policy.id/asset@name#123');
      expect(key).toMatch(/^v1:token:policy_id_asset_name_123/);
    });
  });

  describe('Wallet Data Keys', () => {
    test('should build basic wallet data key', () => {
      const address =
        'addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3n0d3vllmyqwsx5wktcd8cc3sq835lu7drv2xwl2wywfgse35a3x';
      const key = keyBuilder.buildWalletDataKey(address);
      expect(key).toMatch(/^v1:wallet:[a-z0-9_]+$/);
    });

    test('should build wallet data key with provider', () => {
      const address = 'addr1test';
      const key = keyBuilder.buildWalletDataKey(address, undefined, 'blockfrost');
      expect(key).toMatch(/^v1:wallet:addr1test:provider:blockfrost$/);
    });

    test('should build wallet data key with fields', () => {
      const address = 'addr1test';
      const key = keyBuilder.buildWalletDataKey(address, ['balance', 'portfolio']);
      expect(key).toMatch(/^v1:wallet:addr1test:fields:[a-f0-9]{8}$/);
    });

    test('should build wallet data key with provider and fields', () => {
      const address = 'addr1test';
      const key = keyBuilder.buildWalletDataKey(address, ['balance', 'portfolio'], 'blockfrost');
      expect(key).toMatch(/^v1:wallet:addr1test:provider:blockfrost:fields:[a-f0-9]{8}$/);
    });
  });

  describe('Aggregated Keys', () => {
    test('should build aggregated token key', () => {
      const key = keyBuilder.buildAggregatedKey('token', 'lovelace');
      expect(key).toMatch(/^v1:aggregated:token:lovelace$/);
    });

    test('should build aggregated wallet key', () => {
      const key = keyBuilder.buildAggregatedKey('wallet', 'addr1test');
      expect(key).toMatch(/^v1:aggregated:wallet:addr1test$/);
    });

    test('should build aggregated key with providers', () => {
      const key = keyBuilder.buildAggregatedKey('token', 'lovelace', undefined, [
        'coingecko',
        'blockfrost',
      ]);
      expect(key).toMatch(/^v1:aggregated:token:lovelace:providers:[a-f0-9]{8}$/);
    });

    test('should build aggregated key with fields and providers', () => {
      const key = keyBuilder.buildAggregatedKey(
        'token',
        'lovelace',
        ['price', 'marketCap'],
        ['coingecko', 'blockfrost'],
      );
      expect(key).toMatch(
        /^v1:aggregated:token:lovelace:providers:[a-f0-9]{8}:fields:[a-f0-9]{8}$/,
      );
    });
  });

  describe('Provider Keys', () => {
    test('should build provider key', () => {
      const key = keyBuilder.buildProviderKey('coingecko', 'coins/cardano');
      expect(key).toMatch(/^v1:provider:coingecko:coins_cardano$/);
    });

    test('should build provider key with parameters', () => {
      const params = { vs_currency: 'usd', include_24hr_change: true };
      const key = keyBuilder.buildProviderKey('coingecko', 'simple/price', params);
      expect(key).toMatch(/^v1:provider:coingecko:simple_price:params:[a-f0-9]{8}$/);
    });

    test('should generate same hash for same parameters in different order', () => {
      const params1 = { a: 1, b: 2 };
      const params2 = { b: 2, a: 1 };
      const key1 = keyBuilder.buildProviderKey('test', 'endpoint', params1);
      const key2 = keyBuilder.buildProviderKey('test', 'endpoint', params2);
      expect(key1).toBe(key2);
    });
  });

  describe('Health Check Keys', () => {
    test('should build health check key', () => {
      const key = keyBuilder.buildHealthCheckKey('blockfrost');
      expect(key).toBe('v1:health:blockfrost');
    });

    test('should sanitize provider name in health check key', () => {
      const key = keyBuilder.buildHealthCheckKey('custom-provider@v1.0');
      expect(key).toBe('v1:health:custom-provider_v1_0');
    });
  });

  describe('Pattern Building', () => {
    test('should build pattern for token type', () => {
      const pattern = keyBuilder.buildPattern('token');
      expect(pattern).toBe('v1:token*');
    });

    test('should build pattern for specific token', () => {
      const pattern = keyBuilder.buildPattern('token', 'lovelace');
      expect(pattern).toBe('v1:token:lovelace*');
    });

    test('should build pattern for wallet type', () => {
      const pattern = keyBuilder.buildPattern('wallet');
      expect(pattern).toBe('v1:wallet*');
    });

    test('should build pattern for health checks', () => {
      const pattern = keyBuilder.buildPattern('health');
      expect(pattern).toBe('v1:health*');
    });
  });

  describe('Key Parsing', () => {
    test('should parse token data key', () => {
      const key = 'v1:token:lovelace:provider:coingecko:fields:abc12345';
      const metadata = keyBuilder.parseKey(key);

      expect(metadata).toEqual({
        type: 'token',
        identifier: 'lovelace',
        provider: 'coingecko',
        fields: ['multiple'],
      });
    });

    test('should parse wallet data key', () => {
      const key = 'v1:wallet:addr1test:fields:def67890';
      const metadata = keyBuilder.parseKey(key);

      expect(metadata).toEqual({
        type: 'wallet',
        identifier: 'addr1test',
        fields: ['multiple'],
      });
    });

    test('should parse aggregated key', () => {
      const key = 'v1:aggregated:token:lovelace:providers:abc123:fields:def456';
      const metadata = keyBuilder.parseKey(key);

      expect(metadata).toEqual({
        type: 'aggregated',
        identifier: 'lovelace',
        providers: ['multiple'],
        fields: ['multiple'],
      });
    });

    test('should parse simple token key', () => {
      const key = 'v1:token:lovelace';
      const metadata = keyBuilder.parseKey(key);

      expect(metadata).toEqual({
        type: 'token',
        identifier: 'lovelace',
      });
    });

    test('should return null for invalid key format', () => {
      const metadata = keyBuilder.parseKey('invalid:key:format');
      expect(metadata).toBeNull();
    });

    test('should return null for wrong version', () => {
      const metadata = keyBuilder.parseKey('v2:token:lovelace');
      expect(metadata).toBeNull();
    });

    test('should return null for incomplete key', () => {
      const metadata = keyBuilder.parseKey('v1:token');
      expect(metadata).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty fields array', () => {
      const key = keyBuilder.buildTokenDataKey('lovelace', []);
      expect(key).toBe('v1:token:lovelace');
    });

    test('should handle special characters in identifiers', () => {
      const specialId = 'policy123.asset456!@#$%^&*()';
      const key = keyBuilder.buildTokenDataKey(specialId);
      expect(key).toMatch(/^v1:token:[a-z0-9_-]+/);
    });

    test('should handle very long identifiers', () => {
      const longId = 'a'.repeat(200);
      const key = keyBuilder.buildTokenDataKey(longId);
      expect(key).toMatch(/^v1:token:a+$/);
    });

    test('should handle unicode characters', () => {
      const unicodeId = 'policy123.asset🚀';
      const key = keyBuilder.buildTokenDataKey(unicodeId);
      expect(key).toMatch(/^v1:token:[a-z0-9_-]+/);
    });
  });
});

describe('SimpleCacheKeyBuilder', () => {
  let keyBuilder: SimpleCacheKeyBuilder;

  beforeEach(() => {
    keyBuilder = new SimpleCacheKeyBuilder();
  });

  test('should build simple token data key', () => {
    const key = keyBuilder.buildTokenDataKey('lovelace');
    expect(key).toBe('token:lovelace');
  });

  test('should build simple wallet data key', () => {
    const key = keyBuilder.buildWalletDataKey('addr1test');
    expect(key).toBe('wallet:addr1test');
  });

  test('should build simple aggregated key', () => {
    const key = keyBuilder.buildAggregatedKey('token', 'lovelace');
    expect(key).toBe('aggregated:token:lovelace');
  });

  test('should parse simple token key', () => {
    const metadata = keyBuilder.parseKey('token:lovelace');
    expect(metadata).toEqual({
      type: 'token',
      identifier: 'lovelace',
    });
  });

  test('should parse simple wallet key', () => {
    const metadata = keyBuilder.parseKey('wallet:addr1test');
    expect(metadata).toEqual({
      type: 'wallet',
      identifier: 'addr1test',
    });
  });

  test('should parse simple aggregated key', () => {
    const metadata = keyBuilder.parseKey('aggregated:token:lovelace');
    expect(metadata).toEqual({
      type: 'aggregated',
      identifier: 'lovelace',
    });
  });

  test('should handle complex identifiers', () => {
    const complexId = 'policy123.asset456:with:colons';
    const key = keyBuilder.buildTokenDataKey(complexId);
    expect(key).toBe(`token:${complexId}`);

    const metadata = keyBuilder.parseKey(key);
    expect(metadata?.identifier).toBe(complexId);
  });

  test('should return null for invalid format', () => {
    const metadata = keyBuilder.parseKey('invalid');
    expect(metadata).toBeNull();
  });
});
