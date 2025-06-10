import type { ProviderRequestOptions } from '@/providers/base/request-options';
import { NetworkError, RateLimitError, TimeoutError } from '@/types/errors';

export interface HTTPResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
  ok: boolean;
}

export interface HTTPClientConfig {
  baseURL?: string;
  timeout?: number;
  headers?: Record<string, string>;
  retries?: number;
  retryDelay?: number;
}

export interface RateLimitInfo {
  limit?: number;
  remaining?: number;
  reset?: Date;
  retryAfter?: number;
}

export class HTTPClient {
  private config: Required<HTTPClientConfig>;

  constructor(config: HTTPClientConfig = {}) {
    this.config = {
      baseURL: config.baseURL ?? '',
      timeout: config.timeout ?? 10000,
      headers: config.headers ?? {},
      retries: config.retries ?? 3,
      retryDelay: config.retryDelay ?? 1000,
    };
  }

  /**
   * Make a GET request
   */
  async get<T>(url: string, options: ProviderRequestOptions = {}): Promise<HTTPResponse<T>> {
    return this.request<T>('GET', url, undefined, options);
  }

  /**
   * Make a POST request
   */
  async post<T>(
    url: string,
    data?: unknown,
    options: ProviderRequestOptions = {},
  ): Promise<HTTPResponse<T>> {
    return this.request<T>('POST', url, data, options);
  }

  /**
   * Make a PUT request
   */
  async put<T>(
    url: string,
    data?: unknown,
    options: ProviderRequestOptions = {},
  ): Promise<HTTPResponse<T>> {
    return this.request<T>('PUT', url, data, options);
  }

  /**
   * Make a DELETE request
   */
  async delete<T>(url: string, options: ProviderRequestOptions = {}): Promise<HTTPResponse<T>> {
    return this.request<T>('DELETE', url, undefined, options);
  }

  /**
   * Make a generic HTTP request with retry logic
   */
  private async request<T>(
    method: string,
    url: string,
    data?: unknown,
    options: ProviderRequestOptions = {},
  ): Promise<HTTPResponse<T>> {
    const fullURL = this.buildURL(url);
    const requestConfig = this.buildRequestConfig(method, data, options);
    const maxRetries = options.maxRetries ?? this.config.retries;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.makeRequest<T>(fullURL, requestConfig, options);
        return response;
      } catch (error) {
        lastError = error as Error;

        // Don't retry on certain errors
        if (this.shouldNotRetry(error as Error) || attempt === maxRetries) {
          break;
        }

        // Wait before retrying
        const delay = this.calculateRetryDelay(attempt, options);
        await this.sleep(delay);
      }
    }

    // If we get here, all retries failed
    throw lastError ?? new Error('Request failed after retries');
  }

  /**
   * Make the actual HTTP request
   */
  private async makeRequest<T>(
    url: string,
    config: RequestInit,
    options: ProviderRequestOptions,
  ): Promise<HTTPResponse<T>> {
    const timeout = options.timeout ?? this.config.timeout;

    // Create timeout controller
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...config,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Check for rate limiting
      const rateLimitInfo = this.parseRateLimitHeaders(response.headers);
      if (response.status === 429 || rateLimitInfo.retryAfter) {
        throw new RateLimitError('Rate limit exceeded', undefined, rateLimitInfo.retryAfter, {
          rateLimitInfo,
        });
      }

      // Check for other HTTP errors
      if (!response.ok) {
        throw new NetworkError(`HTTP ${response.status}: ${response.statusText}`, response.status, {
          url,
          method: config.method,
        });
      }

      // Parse response
      const data = await this.parseResponse<T>(response, options);

      return {
        data,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        ok: response.ok,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new TimeoutError(`Request timed out after ${timeout}ms`, timeout, { url });
      }

      throw error;
    }
  }

  /**
   * Build the full URL
   */
  private buildURL(url: string): string {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    const base = this.config.baseURL.endsWith('/')
      ? this.config.baseURL.slice(0, -1)
      : this.config.baseURL;
    const path = url.startsWith('/') ? url : `/${url}`;

    return `${base}${path}`;
  }

  /**
   * Build request configuration
   */
  private buildRequestConfig(
    method: string,
    data: unknown,
    options: ProviderRequestOptions,
  ): RequestInit {
    const headers: Record<string, string> = {
      ...this.config.headers,
      ...options.headers,
    };

    // Add content type for POST/PUT with data
    if (data && (method === 'POST' || method === 'PUT')) {
      headers['Content-Type'] = 'application/json';
    }

    const config: RequestInit = {
      method,
      headers,
    };

    // Add body for POST/PUT requests
    if (data && (method === 'POST' || method === 'PUT')) {
      config.body = typeof data === 'string' ? data : JSON.stringify(data);
    }

    return config;
  }

  /**
   * Parse response data
   */
  private async parseResponse<T>(response: Response, options: ProviderRequestOptions): Promise<T> {
    const contentType = response.headers.get('content-type') ?? '';

    if (options.parseResponse === false) {
      return response as unknown as T;
    }

    if (contentType.includes('application/json')) {
      try {
        return (await response.json()) as T;
      } catch (error) {
        throw new Error(`Failed to parse JSON response: ${(error as Error).message}`);
      }
    }

    if (contentType.includes('text/')) {
      return (await response.text()) as unknown as T;
    }

    // Default to text
    return (await response.text()) as unknown as T;
  }

  /**
   * Parse rate limit headers
   */
  private parseRateLimitHeaders(headers: Headers): RateLimitInfo {
    const rateLimitInfo: RateLimitInfo = {};

    // Common rate limit headers
    const limit = headers.get('x-rate-limit-limit') ?? headers.get('x-ratelimit-limit');
    const remaining = headers.get('x-rate-limit-remaining') ?? headers.get('x-ratelimit-remaining');
    const reset = headers.get('x-rate-limit-reset') ?? headers.get('x-ratelimit-reset');
    const retryAfter = headers.get('retry-after');

    if (limit) {
      rateLimitInfo.limit = parseInt(limit, 10);
    }

    if (remaining) {
      rateLimitInfo.remaining = parseInt(remaining, 10);
    }

    if (reset) {
      // Reset can be unix timestamp or seconds from now
      const resetValue = parseInt(reset, 10);
      if (resetValue > 1000000000) {
        // Unix timestamp
        rateLimitInfo.reset = new Date(resetValue * 1000);
      } else {
        // Seconds from now
        rateLimitInfo.reset = new Date(Date.now() + resetValue * 1000);
      }
    }

    if (retryAfter) {
      rateLimitInfo.retryAfter = parseInt(retryAfter, 10) * 1000; // Convert to milliseconds
    }

    return rateLimitInfo;
  }

  /**
   * Determine if error should not be retried
   */
  private shouldNotRetry(error: Error): boolean {
    // Don't retry timeout errors
    if (error instanceof TimeoutError) {
      return true;
    }

    // Don't retry authentication errors, validation errors, etc.
    if (error instanceof NetworkError) {
      const status = error.statusCode;
      // Don't retry 4xx errors except 429 (rate limit)
      return status !== undefined && status >= 400 && status < 500 && status !== 429;
    }

    return false;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number, options: ProviderRequestOptions): number {
    const baseDelay = options.retryDelay ?? this.config.retryDelay;
    const delay = baseDelay * Math.pow(2, attempt);

    // Add jitter (±25%)
    const jitter = delay * 0.25 * (Math.random() * 2 - 1);

    return Math.max(100, delay + jitter);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
