import type {
  CacheEntry,
  CacheEvent,
  CacheEventListener,
  CacheInterface,
  CacheOptions,
  CacheStats,
} from './cache.interface';

class LRUNode<T> {
  key: string;
  entry: CacheEntry<T>;
  prev: LRUNode<T> | null = null;
  next: LRUNode<T> | null = null;

  constructor(key: string, entry: CacheEntry<T>) {
    this.key = key;
    this.entry = entry;
  }
}

export class MemoryCache implements CacheInterface {
  private cache = new Map<string, LRUNode<any>>();
  private head: LRUNode<any> | null = null;
  private tail: LRUNode<any> | null = null;
  private stats: CacheStats;
  private options: Required<CacheOptions>;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private eventListeners: CacheEventListener[] = [];

  constructor(options: CacheOptions = {}) {
    this.options = {
      defaultTtl: options.defaultTtl ?? 300, // 5 minutes default
      maxSize: options.maxSize ?? 1000,
      fieldTtl: options.fieldTtl ?? {},
      enableStats: options.enableStats ?? true,
      cleanupInterval: options.cleanupInterval ?? 60000, // 1 minute
      autoCleanup: options.autoCleanup ?? true,
    };

    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      size: 0,
      maxSize: this.options.maxSize,
      memoryUsage: 0,
    };

    // Start cleanup timer if auto cleanup is enabled
    if (this.options.autoCleanup) {
      this.startCleanupTimer();
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const node = this.cache.get(key);

    if (!node) {
      this.incrementMisses();
      this.emitEvent('miss', key);
      return null;
    }

    // Check if entry has expired
    if (this.isExpired(node.entry)) {
      this.deleteNode(node);
      this.incrementMisses();
      this.emitEvent('expired', key);
      return null;
    }

    // Update access metadata
    node.entry.accessCount++;
    node.entry.lastAccessed = Date.now();

    // Move to head (most recently used)
    this.moveToHead(node);

    this.incrementHits();
    this.emitEvent('hit', key);

    return node.entry.value as T;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const existingNode = this.cache.get(key);
    const now = Date.now();
    const timeToLive = (ttl ?? this.options.defaultTtl) * 1000; // Convert to milliseconds

    const entry: CacheEntry<T> = {
      value,
      ttl: timeToLive,
      createdAt: now,
      expiresAt: now + timeToLive,
      accessCount: 0,
      lastAccessed: now,
    };

    if (existingNode) {
      // Update existing entry
      existingNode.entry = entry;
      this.moveToHead(existingNode);
    } else {
      // Create new entry
      const newNode = new LRUNode(key, entry);

      // Check if we need to evict
      if (this.cache.size >= this.options.maxSize) {
        this.evictLRU();
      }

      this.cache.set(key, newNode);
      this.addToHead(newNode);
      this.stats.size++;
    }

    this.updateMemoryUsage();
    this.emitEvent('set', key);
  }

  async delete(key: string): Promise<boolean> {
    const node = this.cache.get(key);

    if (!node) {
      return false;
    }

    this.deleteNode(node);
    this.emitEvent('delete', key);
    return true;
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.head = null;
    this.tail = null;
    this.stats.size = 0;
    this.stats.memoryUsage = 0;
    this.emitEvent('clear', '');
  }

  async has(key: string): Promise<boolean> {
    const node = this.cache.get(key);

    if (!node) {
      return false;
    }

    // Check if expired
    if (this.isExpired(node.entry)) {
      this.deleteNode(node);
      return false;
    }

    return true;
  }

  async getStats(): Promise<CacheStats> {
    // Clean up expired entries before returning stats
    await this.cleanupExpired();

    const totalRequests = this.stats.hits + this.stats.misses;
    this.stats.hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

    return { ...this.stats };
  }

  async close(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    await this.clear();
  }

  /**
   * Add event listener for cache events
   */
  addEventListener(listener: CacheEventListener): void {
    this.eventListeners.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: CacheEventListener): void {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * Get all cache keys (for debugging)
   */
  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache size
   */
  getSize(): number {
    return this.cache.size;
  }

  /**
   * Manual cleanup of expired entries
   */
  async cleanupExpired(): Promise<number> {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, node] of this.cache.entries()) {
      if (this.isExpired(node.entry)) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      const node = this.cache.get(key);
      if (node) {
        this.deleteNode(node);
        this.emitEvent('expired', key);
      }
    }

    return expiredKeys.length;
  }

  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() > entry.expiresAt;
  }

  private deleteNode(node: LRUNode<any>): void {
    this.cache.delete(node.key);

    // Remove from linked list
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }

    this.stats.size--;
    this.updateMemoryUsage();
  }

  private addToHead(node: LRUNode<any>): void {
    node.prev = null;
    node.next = this.head;

    if (this.head) {
      this.head.prev = node;
    }

    this.head = node;

    if (!this.tail) {
      this.tail = node;
    }
  }

  private moveToHead(node: LRUNode<any>): void {
    // Remove from current position
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      // Node is already head
      return;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }

    // Add to head
    this.addToHead(node);
  }

  private evictLRU(): void {
    if (!this.tail) {
      return;
    }

    const lru = this.tail;
    this.deleteNode(lru);
    this.emitEvent('evicted', lru.key);
  }

  private incrementHits(): void {
    if (this.options.enableStats) {
      this.stats.hits++;
    }
  }

  private incrementMisses(): void {
    if (this.options.enableStats) {
      this.stats.misses++;
    }
  }

  private updateMemoryUsage(): void {
    if (!this.options.enableStats) {
      return;
    }

    // Rough estimation of memory usage
    let usage = 0;
    for (const [key, node] of this.cache.entries()) {
      usage += key.length * 2; // UTF-16 characters
      usage += this.estimateObjectSize(node.entry.value);
      usage += 96; // Estimated overhead for CacheEntry and LRUNode
    }

    this.stats.memoryUsage = usage;
  }

  private estimateObjectSize(obj: any): number {
    if (obj === null || obj === undefined) {
      return 8;
    }

    if (typeof obj === 'string') {
      return obj.length * 2; // UTF-16
    }

    if (typeof obj === 'number') {
      return 8;
    }

    if (typeof obj === 'boolean') {
      return 4;
    }

    if (obj instanceof Date) {
      return 16;
    }

    if (Array.isArray(obj)) {
      return obj.reduce((size, item) => size + this.estimateObjectSize(item), 24);
    }

    if (typeof obj === 'object') {
      return Object.entries(obj).reduce(
        (size, [key, value]) => size + key.length * 2 + this.estimateObjectSize(value),
        24,
      );
    }

    return 24; // Default object overhead
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(async () => {
      await this.cleanupExpired();
    }, this.options.cleanupInterval);
  }

  private emitEvent(event: CacheEvent, key: string): void {
    if (this.eventListeners.length === 0) {
      return;
    }

    for (const listener of this.eventListeners) {
      try {
        listener(event, key);
      } catch (error) {
        // Silently ignore listener errors
        console.warn('Cache event listener error:', error);
      }
    }
  }
}
