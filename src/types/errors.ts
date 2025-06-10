export abstract class CardalabsError extends Error {
  abstract readonly code: string;
  abstract readonly category: ErrorCategory;

  constructor(
    message: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export type ErrorCategory =
  | 'network'
  | 'authentication'
  | 'validation'
  | 'provider'
  | 'cache'
  | 'aggregation'
  | 'configuration'
  | 'rate_limit'
  | 'timeout';

/**
 * Network-related errors (connection issues, timeouts, etc.)
 */
export class NetworkError extends CardalabsError {
  readonly code = 'NETWORK_ERROR';
  readonly category = 'network' as const;

  constructor(
    message: string,
    public readonly statusCode?: number,
    context?: Record<string, unknown>,
  ) {
    super(message, context);
  }
}

/**
 * Authentication/authorization errors
 */
export class AuthenticationError extends CardalabsError {
  readonly code = 'AUTHENTICATION_ERROR';
  readonly category = 'authentication' as const;

  constructor(
    message: string,
    public readonly provider?: string,
    context?: Record<string, unknown>,
  ) {
    super(message, context);
  }
}

/**
 * Input validation errors
 */
export class ValidationError extends CardalabsError {
  readonly code = 'VALIDATION_ERROR';
  readonly category = 'validation' as const;

  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: unknown,
    context?: Record<string, unknown>,
  ) {
    super(message, context);
  }
}

/**
 * Provider-specific errors
 */
export class ProviderError extends CardalabsError {
  readonly code = 'PROVIDER_ERROR';
  readonly category = 'provider' as const;

  constructor(
    message: string,
    public readonly provider: string,
    public readonly originalError?: Error,
    context?: Record<string, unknown>,
  ) {
    super(message, context);
  }
}

/**
 * Caching system errors
 */
export class CacheError extends CardalabsError {
  readonly code = 'CACHE_ERROR';
  readonly category = 'cache' as const;
}

/**
 * Data aggregation errors
 */
export class AggregationError extends CardalabsError {
  readonly code = 'AGGREGATION_ERROR';
  readonly category = 'aggregation' as const;

  constructor(
    message: string,
    public readonly failedProviders?: string[],
    context?: Record<string, unknown>,
  ) {
    super(message, context);
  }
}

/**
 * Configuration errors
 */
export class ConfigurationError extends CardalabsError {
  readonly code = 'CONFIGURATION_ERROR';
  readonly category = 'configuration' as const;
}

/**
 * Rate limiting errors
 */
export class RateLimitError extends CardalabsError {
  readonly code = 'RATE_LIMIT_ERROR';
  readonly category = 'rate_limit' as const;

  constructor(
    message: string,
    public readonly provider?: string,
    public readonly retryAfter?: number,
    context?: Record<string, unknown>,
  ) {
    super(message, context);
  }
}

/**
 * Timeout errors
 */
export class TimeoutError extends CardalabsError {
  readonly code = 'TIMEOUT_ERROR';
  readonly category = 'timeout' as const;

  constructor(
    message: string,
    public readonly timeoutMs?: number,
    context?: Record<string, unknown>,
  ) {
    super(message, context);
  }
}

/**
 * Error response structure for API errors
 */
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    category: ErrorCategory;
    context?: Record<string, unknown>;
    timestamp: Date;
  };
}

/**
 * Error handler configuration
 */
export interface ErrorHandlerConfig {
  // Whether to log errors
  logErrors?: boolean;

  // Whether to include stack traces in logs
  includeStackTrace?: boolean;

  // Custom error logger function
  logger?: (error: CardalabsError) => void;

  // Whether to throw errors or return them
  throwOnError?: boolean;
}

/**
 * Error severity levels
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Error metadata for tracking and debugging
 */
export interface ErrorMetadata {
  severity: ErrorSeverity;
  retryable: boolean;
  userFacing: boolean;
  documentation?: string;
}

/**
 * Mapping of error codes to metadata
 */
export const ERROR_METADATA: Record<string, ErrorMetadata> = {
  NETWORK_ERROR: {
    severity: 'medium',
    retryable: true,
    userFacing: false,
  },
  AUTHENTICATION_ERROR: {
    severity: 'high',
    retryable: false,
    userFacing: true,
    documentation: 'Check your API keys and credentials',
  },
  VALIDATION_ERROR: {
    severity: 'medium',
    retryable: false,
    userFacing: true,
    documentation: 'Verify input parameters',
  },
  PROVIDER_ERROR: {
    severity: 'medium',
    retryable: true,
    userFacing: false,
  },
  CACHE_ERROR: {
    severity: 'low',
    retryable: true,
    userFacing: false,
  },
  AGGREGATION_ERROR: {
    severity: 'medium',
    retryable: true,
    userFacing: false,
  },
  CONFIGURATION_ERROR: {
    severity: 'high',
    retryable: false,
    userFacing: true,
    documentation: 'Check SDK configuration',
  },
  RATE_LIMIT_ERROR: {
    severity: 'medium',
    retryable: true,
    userFacing: false,
  },
  TIMEOUT_ERROR: {
    severity: 'medium',
    retryable: true,
    userFacing: false,
  },
};
