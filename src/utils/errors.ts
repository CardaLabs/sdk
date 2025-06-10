/**
 * Error handling utilities for the CardaLabs SDK
 */
import {
  AggregationError,
  AuthenticationError,
  CacheError,
  CardalabsError,
  ConfigurationError,
  ERROR_METADATA,
  NetworkError,
  ProviderError,
  RateLimitError,
  TimeoutError,
  ValidationError,
} from '@/types/errors';
import type { ErrorCategory, ErrorHandlerConfig } from '@/types/errors';

/**
 * Error handler for managing SDK errors
 */
export class ErrorHandler {
  private config: Required<ErrorHandlerConfig>;

  constructor(config: ErrorHandlerConfig = {}) {
    this.config = {
      logErrors: config.logErrors ?? true,
      includeStackTrace: config.includeStackTrace ?? false,
      logger: config.logger ?? this.defaultLogger,
      throwOnError: config.throwOnError ?? true,
    };
  }

  /**
   * Handle an error based on configuration
   */
  handle(error: Error | CardalabsError): CardalabsError {
    const cardalabsError = this.normalizeError(error);

    if (this.config.logErrors) {
      this.config.logger(cardalabsError);
    }

    if (this.config.throwOnError) {
      throw cardalabsError;
    }

    return cardalabsError;
  }

  /**
   * Convert any error to a CardalabsError
   */
  normalizeError(error: Error | CardalabsError): CardalabsError {
    if (error instanceof CardalabsError) {
      return error;
    }

    // Try to categorize the error based on message/type
    if (this.isNetworkError(error)) {
      return new NetworkError(error.message, undefined, { originalError: error });
    }

    if (this.isAuthError(error)) {
      return new AuthenticationError(error.message, undefined, { originalError: error });
    }

    if (this.isTimeoutError(error)) {
      return new TimeoutError(error.message, undefined, { originalError: error });
    }

    if (this.isValidationError(error)) {
      return new ValidationError(error.message, undefined, undefined, { originalError: error });
    }

    // Default to provider error
    return new ProviderError(error.message, 'unknown', error);
  }

  /**
   * Default error logger
   */
  private defaultLogger = (error: CardalabsError): void => {
    const metadata = ERROR_METADATA[error.code];
    const severity = metadata?.severity ?? 'medium';

    const logLevel = this.getLogLevel(severity);
    const message = this.formatErrorMessage(error);

    switch (logLevel) {
      case 'error':
        console.error(message);
        break;
      case 'warn':
        console.warn(message);
        break;
      case 'info':
        console.info(message);
        break;
      default:
        console.log(message);
    }
  };

  /**
   * Format error message for logging
   */
  private formatErrorMessage(error: CardalabsError): string {
    const timestamp = new Date().toISOString();
    const metadata = ERROR_METADATA[error.code];

    let message = `[${timestamp}] ${error.name}: ${error.message}`;

    if (error.context) {
      message += `\nContext: ${JSON.stringify(error.context, null, 2)}`;
    }

    if (metadata) {
      message += `\nCategory: ${error.category}`;
      message += `\nSeverity: ${metadata.severity}`;
      message += `\nRetryable: ${metadata.retryable}`;
    }

    if (this.config.includeStackTrace && error.stack) {
      message += `\nStack: ${error.stack}`;
    }

    return message;
  }

  /**
   * Get appropriate log level for error severity
   */
  private getLogLevel(severity: string): 'error' | 'warn' | 'info' | 'log' {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'error';
      case 'medium':
        return 'warn';
      case 'low':
        return 'info';
      default:
        return 'log';
    }
  }

  /**
   * Check if error is network-related
   */
  private isNetworkError(error: Error): boolean {
    const networkKeywords = [
      'network',
      'connection',
      'timeout',
      'dns',
      'socket',
      'econnrefused',
      'enotfound',
      'etimedout',
    ];

    const message = error.message.toLowerCase();
    return networkKeywords.some((keyword) => message.includes(keyword));
  }

  /**
   * Check if error is authentication-related
   */
  private isAuthError(error: Error): boolean {
    const authKeywords = [
      'unauthorized',
      'forbidden',
      'authentication',
      'api key',
      'token',
      '401',
      '403',
    ];

    const message = error.message.toLowerCase();
    return authKeywords.some((keyword) => message.includes(keyword));
  }

  /**
   * Check if error is timeout-related
   */
  private isTimeoutError(error: Error): boolean {
    const timeoutKeywords = ['timeout', 'timed out', 'time limit', 'deadline'];

    const message = error.message.toLowerCase();
    return timeoutKeywords.some((keyword) => message.includes(keyword));
  }

  /**
   * Check if error is validation-related
   */
  private isValidationError(error: Error): boolean {
    const validationKeywords = ['validation', 'invalid', 'required', 'missing', 'format', 'schema'];

    const message = error.message.toLowerCase();
    return validationKeywords.some((keyword) => message.includes(keyword));
  }
}

/**
 * Error recovery utilities
 */
export class ErrorRecovery {
  /**
   * Determine if an error is recoverable
   */
  static isRecoverable(error: CardalabsError): boolean {
    const metadata = ERROR_METADATA[error.code];
    return metadata?.retryable ?? false;
  }

  /**
   * Get suggested retry delay for an error
   */
  static getRetryDelay(error: CardalabsError, attempt: number): number {
    if (!this.isRecoverable(error)) {
      return 0;
    }

    // Exponential backoff with jitter
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);

    // Add jitter (±25%)
    const jitter = delay * 0.25 * (Math.random() * 2 - 1);
    return Math.max(100, delay + jitter);
  }

  /**
   * Check if error should trigger provider fallback
   */
  static shouldFallback(error: CardalabsError): boolean {
    const fallbackCategories: ErrorCategory[] = ['network', 'provider', 'rate_limit', 'timeout'];

    return fallbackCategories.includes(error.category);
  }
}

/**
 * Error aggregation for collecting multiple errors
 */
export class ErrorAggregator {
  private errors: CardalabsError[] = [];

  /**
   * Add an error to the aggregator
   */
  add(error: Error | CardalabsError): void {
    const normalizedError = new ErrorHandler().normalizeError(error);
    this.errors.push(normalizedError);
  }

  /**
   * Get all collected errors
   */
  getErrors(): CardalabsError[] {
    return [...this.errors];
  }

  /**
   * Check if any errors were collected
   */
  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  /**
   * Get the most severe error
   */
  getMostSevere(): CardalabsError | null {
    if (this.errors.length === 0) {
      return null;
    }

    const severityOrder = ['critical', 'high', 'medium', 'low'];

    return this.errors.reduce((mostSevere, current) => {
      const currentMetadata = ERROR_METADATA[current.code];
      const mostSevereMetadata = ERROR_METADATA[mostSevere.code];

      const currentSeverity = currentMetadata?.severity ?? 'low';
      const mostSevereSeverity = mostSevereMetadata?.severity ?? 'low';

      const currentIndex = severityOrder.indexOf(currentSeverity);
      const mostSevereIndex = severityOrder.indexOf(mostSevereSeverity);

      return currentIndex < mostSevereIndex ? current : mostSevere;
    });
  }

  /**
   * Create an aggregation error from collected errors
   */
  toAggregationError(): AggregationError {
    const providers = this.errors
      .filter((error) => error instanceof ProviderError)
      .map((error) => (error as ProviderError).provider);

    const uniqueProviders = [...new Set(providers)];

    return new AggregationError(
      `Multiple errors occurred: ${this.errors.map((e) => e.message).join('; ')}`,
      uniqueProviders,
      { errors: this.errors },
    );
  }

  /**
   * Clear all collected errors
   */
  clear(): void {
    this.errors = [];
  }
}
