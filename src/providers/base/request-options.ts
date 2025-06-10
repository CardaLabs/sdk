/**
 * Request options and configuration for provider calls
 */
import type { RequestOptions } from '@/types/common';

/**
 * Extended request options with provider-specific features
 */
export interface ProviderRequestOptions extends RequestOptions {
  // HTTP specific options
  headers?: Record<string, string>;
  userAgent?: string;

  // Request batching
  batchSize?: number;
  batchDelay?: number;

  // Response handling
  validateResponse?: boolean;
  parseResponse?: boolean;

  // Rate limiting
  respectRateLimit?: boolean;
  rateLimitBuffer?: number; // Extra time to wait beyond rate limit

  // Data freshness requirements
  maxAge?: number; // Maximum age of cached data in seconds
  minFreshness?: number; // Minimum freshness required

  // Fallback behavior
  allowPartialFailure?: boolean;
  failureStrategy?: 'fail_fast' | 'best_effort' | 'fallback_only';
}

/**
 * Request context for tracking and debugging
 */
export interface RequestContext {
  requestId: string;
  timestamp: Date;
  provider: string;
  method: string;
  parameters: Record<string, unknown>;
  options: ProviderRequestOptions;
}

/**
 * Request builder for constructing provider requests
 */
export class RequestBuilder {
  private options: ProviderRequestOptions = {};

  /**
   * Set cache preferences
   */
  cache(useCache: boolean, timeout?: number): this {
    this.options.useCache = useCache;
    if (timeout !== undefined) {
      this.options.cacheTimeout = timeout;
    }
    return this;
  }

  /**
   * Set timeout for the request
   */
  timeout(timeoutMs: number): this {
    this.options.timeout = timeoutMs;
    return this;
  }

  /**
   * Set retry configuration
   */
  retry(maxRetries: number, delay?: number): this {
    this.options.maxRetries = maxRetries;
    if (delay !== undefined) {
      this.options.retryDelay = delay;
    }
    return this;
  }

  /**
   * Set provider preferences
   */
  providers(preferred: string[], fallback?: string[]): this {
    this.options.preferredProviders = preferred;
    if (fallback) {
      this.options.fallbackProviders = fallback;
    }
    return this;
  }

  /**
   * Set custom headers
   */
  headers(headers: Record<string, string>): this {
    this.options.headers = { ...this.options.headers, ...headers };
    return this;
  }

  /**
   * Set batch configuration
   */
  batch(size: number, delay?: number): this {
    this.options.batchSize = size;
    if (delay !== undefined) {
      this.options.batchDelay = delay;
    }
    return this;
  }

  /**
   * Set data freshness requirements
   */
  freshness(maxAge: number, minFreshness?: number): this {
    this.options.maxAge = maxAge;
    if (minFreshness !== undefined) {
      this.options.minFreshness = minFreshness;
    }
    return this;
  }

  /**
   * Set failure handling strategy
   */
  onFailure(strategy: 'fail_fast' | 'best_effort' | 'fallback_only'): this {
    this.options.failureStrategy = strategy;
    return this;
  }

  /**
   * Enable partial failure tolerance
   */
  allowPartial(allow = true): this {
    this.options.allowPartialFailure = allow;
    return this;
  }

  /**
   * Build the final request options
   */
  build(): ProviderRequestOptions {
    return { ...this.options };
  }
}

/**
 * Default request options for different use cases
 */
export const DEFAULT_REQUEST_OPTIONS: Record<string, ProviderRequestOptions> = {
  // Fast, real-time data (e.g., current prices)
  realtime: {
    useCache: true,
    cacheTimeout: 30,
    timeout: 5000,
    maxRetries: 2,
    retryDelay: 1000,
    maxAge: 60,
    failureStrategy: 'best_effort',
    respectRateLimit: true,
  },

  // Standard data requests
  standard: {
    useCache: true,
    cacheTimeout: 300,
    timeout: 10000,
    maxRetries: 3,
    retryDelay: 2000,
    maxAge: 600,
    failureStrategy: 'fallback_only',
    respectRateLimit: true,
  },

  // Historical/analytical data
  analytical: {
    useCache: true,
    cacheTimeout: 3600,
    timeout: 30000,
    maxRetries: 2,
    retryDelay: 5000,
    maxAge: 7200,
    failureStrategy: 'fail_fast',
    respectRateLimit: true,
    rateLimitBuffer: 1000,
  },

  // Batch operations
  batch: {
    useCache: true,
    cacheTimeout: 600,
    timeout: 60000,
    maxRetries: 1,
    batchSize: 50,
    batchDelay: 100,
    allowPartialFailure: true,
    failureStrategy: 'best_effort',
    respectRateLimit: true,
    rateLimitBuffer: 2000,
  },
};

/**
 * Request option validator
 */
export class RequestOptionsValidator {
  static validate(options: ProviderRequestOptions): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate timeout
    if (options.timeout !== undefined && options.timeout <= 0) {
      errors.push('Timeout must be greater than 0');
    }

    // Validate cache timeout
    if (options.cacheTimeout !== undefined && options.cacheTimeout < 0) {
      errors.push('Cache timeout must be non-negative');
    }

    // Validate retry settings
    if (options.maxRetries !== undefined && options.maxRetries < 0) {
      errors.push('Max retries must be non-negative');
    }

    if (options.retryDelay !== undefined && options.retryDelay < 0) {
      errors.push('Retry delay must be non-negative');
    }

    // Validate batch settings
    if (options.batchSize !== undefined && options.batchSize <= 0) {
      errors.push('Batch size must be greater than 0');
    }

    if (options.batchDelay !== undefined && options.batchDelay < 0) {
      errors.push('Batch delay must be non-negative');
    }

    // Validate freshness settings
    if (options.maxAge !== undefined && options.maxAge < 0) {
      errors.push('Max age must be non-negative');
    }

    if (options.minFreshness !== undefined && options.minFreshness < 0) {
      errors.push('Min freshness must be non-negative');
    }

    // Validate rate limit buffer
    if (options.rateLimitBuffer !== undefined && options.rateLimitBuffer < 0) {
      errors.push('Rate limit buffer must be non-negative');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Merge request options with defaults and validation
   */
  static merge(
    base: ProviderRequestOptions,
    override: ProviderRequestOptions = {},
  ): ProviderRequestOptions {
    const merged = { ...base, ...override };

    // Merge headers separately
    if (base.headers || override.headers) {
      merged.headers = { ...base.headers, ...override.headers };
    }

    const validation = this.validate(merged);
    if (!validation.valid) {
      throw new Error(`Invalid request options: ${validation.errors.join(', ')}`);
    }

    return merged;
  }
}
