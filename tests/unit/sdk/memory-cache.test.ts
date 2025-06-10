/**
 * Unit tests for MemoryCache
 */
import type { CacheOptions } from '../../../src/sdk/cache/cache.interface';
import { MemoryCache } from '../../../src/sdk/cache/memory-cache';

describe('MemoryCache', () => {
  let cache: MemoryCache;

  beforeEach(() => {
    cache = new MemoryCache({
      defaultTtl: 300,
      maxSize: 100,
      enableStats: true,
      autoCleanup: false, // Disable for testing
    });
  });

  afterEach(async () => {
    await cache.close();
  });

  describe('Basic Operations', () => {
    test('should store and retrieve values', async () => {
      await cache.set('test-key', 'test-value');
      const result = await cache.get('test-key');
      expect(result).toBe('test-value');
    });

    test('should return null for non-existent keys', async () => {
      const result = await cache.get('non-existent');
      expect(result).toBeNull();
    });

    test('should store complex objects', async () => {
      const complexObject = {
        id: 1,
        name: 'Test Token',
        price: 1.23,
        metadata: {
          symbol: 'TEST',
          decimals: 6,
        },
      };

      await cache.set('complex-key', complexObject);
      const result = await cache.get('complex-key');
      expect(result).toEqual(complexObject);
    });

    test('should delete values', async () => {
      await cache.set('delete-me', 'value');
      expect(await cache.has('delete-me')).toBe(true);

      const deleted = await cache.delete('delete-me');
      expect(deleted).toBe(true);
      expect(await cache.has('delete-me')).toBe(false);
    });

    test('should clear all values', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');

      await cache.clear();

      expect(await cache.get('key1')).toBeNull();
      expect(await cache.get('key2')).toBeNull();
    });
  });

  describe('TTL (Time To Live)', () => {
    test('should expire values after TTL', async () => {
      await cache.set('expire-key', 'expire-value', 1); // 1 second TTL

      // Should exist immediately
      expect(await cache.get('expire-key')).toBe('expire-value');

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should be null after expiration
      expect(await cache.get('expire-key')).toBeNull();
    });

    test('should use default TTL when not specified', async () => {
      const shortTtlCache = new MemoryCache({
        defaultTtl: 1, // 1 second default
        autoCleanup: false,
      });

      await shortTtlCache.set('default-ttl', 'value');

      // Should exist immediately
      expect(await shortTtlCache.get('default-ttl')).toBe('value');

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should be null after expiration
      expect(await shortTtlCache.get('default-ttl')).toBeNull();

      await shortTtlCache.close();
    });

    test('should handle zero TTL', async () => {
      await cache.set('zero-ttl', 'value', 0);

      // Add a tiny delay to ensure expiration
      await new Promise((resolve) => setTimeout(resolve, 1));

      // With zero TTL, the item should be expired
      expect(await cache.get('zero-ttl')).toBeNull();
    });
  });

  describe('LRU Eviction', () => {
    test('should evict least recently used items when cache is full', async () => {
      const smallCache = new MemoryCache({
        maxSize: 3,
        defaultTtl: 300,
        autoCleanup: false,
      });

      // Fill cache to capacity
      await smallCache.set('key1', 'value1');
      await smallCache.set('key2', 'value2');
      await smallCache.set('key3', 'value3');

      // All should exist
      expect(await smallCache.has('key1')).toBe(true);
      expect(await smallCache.has('key2')).toBe(true);
      expect(await smallCache.has('key3')).toBe(true);

      // Access key1 to make it recently used
      await smallCache.get('key1');

      // Add new item, should evict key2 (least recently used)
      await smallCache.set('key4', 'value4');

      expect(await smallCache.has('key1')).toBe(true); // Recently accessed
      expect(await smallCache.has('key2')).toBe(false); // Evicted
      expect(await smallCache.has('key3')).toBe(true); // Still there
      expect(await smallCache.has('key4')).toBe(true); // Newly added

      await smallCache.close();
    });

    test('should update LRU order on access', async () => {
      const smallCache = new MemoryCache({
        maxSize: 2,
        defaultTtl: 300,
        autoCleanup: false,
      });

      await smallCache.set('key1', 'value1');
      await smallCache.set('key2', 'value2');

      // Access key1 to make it most recently used
      await smallCache.get('key1');

      // Add new item, should evict key2
      await smallCache.set('key3', 'value3');

      expect(await smallCache.has('key1')).toBe(true);
      expect(await smallCache.has('key2')).toBe(false);
      expect(await smallCache.has('key3')).toBe(true);

      await smallCache.close();
    });
  });

  describe('Statistics', () => {
    test('should track cache hits and misses', async () => {
      await cache.set('stats-key', 'stats-value');

      // Hit
      await cache.get('stats-key');

      // Miss
      await cache.get('non-existent');

      const stats = await cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
    });

    test('should track cache size', async () => {
      const initialStats = await cache.getStats();
      expect(initialStats.size).toBe(0);

      await cache.set('size-key1', 'value1');
      await cache.set('size-key2', 'value2');

      const updatedStats = await cache.getStats();
      expect(updatedStats.size).toBe(2);
    });

    test('should estimate memory usage', async () => {
      const initialStats = await cache.getStats();
      const initialMemory = initialStats.memoryUsage || 0;

      await cache.set('memory-key', 'memory-value');

      const updatedStats = await cache.getStats();
      const updatedMemory = updatedStats.memoryUsage || 0;

      expect(updatedMemory).toBeGreaterThan(initialMemory);
    });
  });

  describe('Event Handling', () => {
    test('should emit events for cache operations', async () => {
      const events: Array<{ event: string; key: string }> = [];

      cache.addEventListener((event, key) => {
        events.push({ event, key });
      });

      await cache.set('event-key', 'event-value');
      await cache.get('event-key');
      await cache.get('non-existent');
      await cache.delete('event-key');

      expect(events).toContainEqual({ event: 'set', key: 'event-key' });
      expect(events).toContainEqual({ event: 'hit', key: 'event-key' });
      expect(events).toContainEqual({ event: 'miss', key: 'non-existent' });
      expect(events).toContainEqual({ event: 'delete', key: 'event-key' });
    });
  });

  describe('Cleanup', () => {
    test('should remove expired entries during cleanup', async () => {
      const cleanupCache = new MemoryCache({
        defaultTtl: 1, // 1 second
        autoCleanup: false,
      });

      await cleanupCache.set('expire1', 'value1', 1);
      await cleanupCache.set('expire2', 'value2', 1);
      await cleanupCache.set('keep', 'value3', 10); // Longer TTL

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const removedCount = await cleanupCache.cleanupExpired();
      expect(removedCount).toBe(2);

      expect(await cleanupCache.has('expire1')).toBe(false);
      expect(await cleanupCache.has('expire2')).toBe(false);
      expect(await cleanupCache.has('keep')).toBe(true);

      await cleanupCache.close();
    });
  });

  describe('Edge Cases', () => {
    test('should handle undefined and null values', async () => {
      await cache.set('undefined-key', undefined);
      await cache.set('null-key', null);

      expect(await cache.get('undefined-key')).toBeUndefined();
      expect(await cache.get('null-key')).toBeNull();
    });

    test('should handle empty strings and objects', async () => {
      await cache.set('empty-string', '');
      await cache.set('empty-object', {});
      await cache.set('empty-array', []);

      expect(await cache.get('empty-string')).toBe('');
      expect(await cache.get('empty-object')).toEqual({});
      expect(await cache.get('empty-array')).toEqual([]);
    });

    test('should handle concurrent operations', async () => {
      const promises = [];

      // Concurrent sets
      for (let i = 0; i < 10; i++) {
        promises.push(cache.set(`concurrent-${i}`, `value-${i}`));
      }

      await Promise.all(promises);

      // Verify all values were set
      for (let i = 0; i < 10; i++) {
        expect(await cache.get(`concurrent-${i}`)).toBe(`value-${i}`);
      }
    });

    test('should handle large objects', async () => {
      const largeObject = {
        data: new Array(1000).fill(0).map((_, i) => ({
          id: i,
          name: `Item ${i}`,
          description: `This is item number ${i} with some description text`,
        })),
      };

      await cache.set('large-object', largeObject);
      const result = await cache.get('large-object');

      expect(result).toEqual(largeObject);
      expect(result.data).toHaveLength(1000);
    });
  });

  describe('Configuration', () => {
    test('should respect custom configuration', async () => {
      const customCache = new MemoryCache({
        defaultTtl: 60,
        maxSize: 50,
        enableStats: false,
        cleanupInterval: 30000,
        autoCleanup: true,
      });

      // Test that custom configuration is applied
      await customCache.set('config-test', 'value');
      expect(await customCache.get('config-test')).toBe('value');

      const stats = await customCache.getStats();
      // Stats should still work even if tracking is disabled for some metrics
      expect(typeof stats.size).toBe('number');

      await customCache.close();
    });

    test('should use default configuration when not provided', async () => {
      const defaultCache = new MemoryCache();

      await defaultCache.set('default-test', 'value');
      expect(await defaultCache.get('default-test')).toBe('value');

      await defaultCache.close();
    });
  });
});
