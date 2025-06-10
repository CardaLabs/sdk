/**
 * Retry logic utilities for the Cardalabs SDK
 */
import type { CardalabsError } from '@/types/errors';

import { ErrorRecovery } from './errors';

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
  shouldRetry?: (error: Error, attempt: number) => boolean;
}

/**
 * Retry result
 */
export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalTime: number;
}

/**
 * Retry attempt information
 */
export interface RetryAttempt {
  attempt: number;
  delay: number;
  error?: Error;
  timestamp: Date;
}

/**
 * Default retry configurations for different scenarios
 */
export const DEFAULT_RETRY_CONFIGS: Record<string, RetryConfig> = {
  // Standard API calls
  standard: {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    jitter: true,
  },

  // Quick retries for fast operations
  quick: {
    maxAttempts: 2,
    baseDelay: 500,
    maxDelay: 2000,
    backoffMultiplier: 2,
    jitter: true,
  },

  // Aggressive retries for critical operations
  aggressive: {
    maxAttempts: 5,
    baseDelay: 2000,
    maxDelay: 30000,
    backoffMultiplier: 1.5,
    jitter: true,
  },

  // No retries
  none: {
    maxAttempts: 1,
    baseDelay: 0,
    maxDelay: 0,
    backoffMultiplier: 1,
    jitter: false,
  },
};

/**
 * Retry executor with configurable backoff strategies
 */
export class RetryExecutor {
  private config: RetryConfig;
  private attempts: RetryAttempt[] = [];

  constructor(config: Partial<RetryConfig> = {}) {
    const baseConfig = DEFAULT_RETRY_CONFIGS.standard;
    if (!baseConfig) {
      throw new Error('Default retry configuration not found');
    }
    this.config = {
      maxAttempts: config.maxAttempts ?? baseConfig.maxAttempts,
      baseDelay: config.baseDelay ?? baseConfig.baseDelay,
      maxDelay: config.maxDelay ?? baseConfig.maxDelay,
      backoffMultiplier: config.backoffMultiplier ?? baseConfig.backoffMultiplier,
      jitter: config.jitter ?? baseConfig.jitter,
      shouldRetry: config.shouldRetry ?? baseConfig.shouldRetry,
    };
  }

  /**
   * Execute a function with retry logic
   */
  async execute<T>(fn: () => Promise<T>, customConfig?: Partial<RetryConfig>): Promise<T> {
    const config = customConfig ? { ...this.config, ...customConfig } : this.config;
    const startTime = Date.now();

    this.attempts = [];

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      const attemptStart = Date.now();

      try {
        const result = await fn();

        this.attempts.push({
          attempt,
          delay: 0,
          timestamp: new Date(attemptStart),
        });

        return result;
      } catch (error) {
        const attemptError = error as Error;

        this.attempts.push({
          attempt,
          delay: attempt < config.maxAttempts ? this.calculateDelay(attempt, config) : 0,
          error: attemptError,
          timestamp: new Date(attemptStart),
        });

        // If this is the last attempt, throw the error
        if (attempt === config.maxAttempts) {
          throw error;
        }

        // Check if we should retry this error
        if (config.shouldRetry && !config.shouldRetry(attemptError, attempt)) {
          throw error;
        }

        // Check if error is retryable using SDK error types
        if (attemptError instanceof Error && !this.isRetryableError(attemptError)) {
          throw error;
        }

        // Wait before next attempt
        const delay = this.calculateDelay(attempt, config);
        await this.sleep(delay);
      }
    }

    // This should never be reached, but TypeScript needs it
    throw new Error('Retry executor failed unexpectedly');
  }

  /**
   * Execute with detailed result information
   */
  async executeWithResult<T>(
    fn: () => Promise<T>,
    customConfig?: Partial<RetryConfig>,
  ): Promise<RetryResult<T>> {
    const startTime = Date.now();

    try {
      const result = await this.execute(fn, customConfig);

      return {
        success: true,
        result,
        attempts: this.attempts.length,
        totalTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        attempts: this.attempts.length,
        totalTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Get retry attempts history
   */
  getAttempts(): RetryAttempt[] {
    return [...this.attempts];
  }

  /**
   * Calculate delay for next attempt with backoff and jitter
   */
  private calculateDelay(attempt: number, config: RetryConfig): number {
    let delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);

    // Apply maximum delay
    delay = Math.min(delay, config.maxDelay);

    // Apply jitter if enabled
    if (config.jitter) {
      const jitterRange = delay * 0.1; // ±10% jitter
      const jitter = (Math.random() * 2 - 1) * jitterRange;
      delay += jitter;
    }

    return Math.max(0, Math.round(delay));
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: Error): boolean {
    // Use SDK error recovery logic if available
    if ('category' in error) {
      return ErrorRecovery.isRecoverable(error as CardalabsError);
    }

    // Fallback to simple heuristics
    const retryablePatterns = [
      /timeout/i,
      /network/i,
      /connection/i,
      /rate limit/i,
      /too many requests/i,
      /service unavailable/i,
      /internal server error/i,
      /bad gateway/i,
      /gateway timeout/i,
    ];

    return retryablePatterns.some((pattern) => pattern.test(error.message));
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Circuit breaker for preventing cascading failures
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime: Date | null = null;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private config: {
      failureThreshold: number;
      recoveryTime: number; // Time in ms before attempting recovery
      successThreshold: number; // Successes needed to close circuit
    } = {
      failureThreshold: 5,
      recoveryTime: 60000, // 1 minute
      successThreshold: 2,
    },
  ) {}

  /**
   * Execute function through circuit breaker
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.shouldAttemptRecovery()) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Get current circuit breaker state
   */
  getState(): { state: string; failures: number; lastFailure: Date | null } {
    return {
      state: this.state,
      failures: this.failures,
      lastFailure: this.lastFailureTime,
    };
  }

  /**
   * Reset circuit breaker to closed state
   */
  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.lastFailureTime = null;
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    if (this.state === 'half-open') {
      // In half-open state, we need consecutive successes to close
      this.failures = Math.max(0, this.failures - 1);

      if (this.failures === 0) {
        this.state = 'closed';
      }
    } else {
      // In closed state, reset failure count
      this.failures = 0;
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = new Date();

    if (this.failures >= this.config.failureThreshold) {
      this.state = 'open';
    }
  }

  /**
   * Check if we should attempt recovery from open state
   */
  private shouldAttemptRecovery(): boolean {
    if (!this.lastFailureTime) {
      return true;
    }

    const timeSinceLastFailure = Date.now() - this.lastFailureTime.getTime();
    return timeSinceLastFailure >= this.config.recoveryTime;
  }
}

/**
 * Retry utility functions
 */
export class RetryUtils {
  /**
   * Create a retry decorator for functions
   */
  static withRetry<T extends (...args: unknown[]) => Promise<unknown>>(
    fn: T,
    config?: Partial<RetryConfig>,
  ): T {
    const executor = new RetryExecutor(config);

    return ((...args: Parameters<T>) => {
      return executor.execute(() => fn(...args));
    }) as T;
  }

  /**
   * Create a circuit breaker decorator for functions
   */
  static withCircuitBreaker<T extends (...args: unknown[]) => Promise<unknown>>(
    fn: T,
    config?: {
      failureThreshold?: number;
      recoveryTime?: number;
      successThreshold?: number;
    },
  ): T {
    const breakerConfig = {
      failureThreshold: 5,
      recoveryTime: 60000,
      successThreshold: 3,
      ...config,
    };
    const breaker = new CircuitBreaker(breakerConfig);

    return ((...args: Parameters<T>) => {
      return breaker.execute(() => fn(...args));
    }) as T;
  }

  /**
   * Combine retry and circuit breaker
   */
  static withRetryAndCircuitBreaker<T extends (...args: unknown[]) => Promise<unknown>>(
    fn: T,
    retryConfig?: Partial<RetryConfig>,
    circuitConfig?: {
      failureThreshold?: number;
      recoveryTime?: number;
      successThreshold?: number;
    },
  ): T {
    const executor = new RetryExecutor(retryConfig);
    const breakerConfig = {
      failureThreshold: 5,
      recoveryTime: 60000,
      successThreshold: 3,
      ...circuitConfig,
    };
    const breaker = new CircuitBreaker(breakerConfig);

    return ((...args: Parameters<T>) => {
      return breaker.execute(() => executor.execute(() => fn(...args)));
    }) as T;
  }
}
