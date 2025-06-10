/**
 * Unit tests for HTTPClient
 */
import { NetworkError, RateLimitError, TimeoutError } from '../../../src/types/errors';
import { HTTPClient } from '../../../src/utils/http-client';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Helper function to create proper mock responses
const createMockResponse = (options: {
  ok?: boolean;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  jsonData?: any;
  textData?: string;
  shouldJsonFail?: boolean;
  shouldTextFail?: boolean;
}) => {
  const {
    ok = true,
    status = 200,
    statusText = 'OK',
    headers = {},
    jsonData,
    textData,
    shouldJsonFail = false,
    shouldTextFail = false,
  } = options;

  // Set appropriate content-type header based on data type
  const finalHeaders = { ...headers };
  if (jsonData !== undefined && !finalHeaders['content-type']) {
    finalHeaders['content-type'] = 'application/json';
  } else if (textData !== undefined && !finalHeaders['content-type']) {
    finalHeaders['content-type'] = 'text/plain';
  }

  const mockResponse = {
    ok,
    status,
    statusText,
    headers: new Headers(finalHeaders),
    json: jest.fn(),
    text: jest.fn(),
  };

  // Configure json() method
  if (shouldJsonFail) {
    mockResponse.json.mockRejectedValue(new Error('Invalid JSON'));
  } else if (jsonData !== undefined) {
    mockResponse.json.mockResolvedValue(jsonData);
  } else {
    // Default JSON response
    mockResponse.json.mockResolvedValue({});
  }

  // Configure text() method
  if (shouldTextFail) {
    mockResponse.text.mockRejectedValue(new Error('Failed to read text'));
  } else if (textData !== undefined) {
    mockResponse.text.mockResolvedValue(textData);
  } else {
    // Default text response
    mockResponse.text.mockResolvedValue(jsonData ? JSON.stringify(jsonData) : '');
  }

  return mockResponse;
};

describe('HTTPClient', () => {
  let client: HTTPClient;

  beforeEach(() => {
    client = new HTTPClient({
      baseURL: 'https://api.example.com',
      timeout: 5000,
      headers: { 'User-Agent': 'test-client' },
      retries: 2,
      retryDelay: 100,
    });

    jest.clearAllMocks();
  });

  describe('Basic HTTP Methods', () => {
    test('should make GET request', async () => {
      const mockResponse = createMockResponse({ jsonData: { data: 'test' } });

      mockFetch.mockResolvedValue(mockResponse);

      const response = await client.get('/test');

      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/test', {
        method: 'GET',
        headers: { 'User-Agent': 'test-client' },
        signal: expect.any(AbortSignal),
      });

      expect(response.data).toEqual({ data: 'test' });
      expect(response.status).toBe(200);
      expect(response.ok).toBe(true);
    });

    test('should make POST request with data', async () => {
      const mockResponse = createMockResponse({ jsonData: { id: 1 } });

      mockFetch.mockResolvedValue(mockResponse);

      const postData = { name: 'test', value: 123 };
      const response = await client.post('/create', postData);

      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/create', {
        method: 'POST',
        headers: {
          'User-Agent': 'test-client',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(postData),
        signal: expect.any(AbortSignal),
      });

      expect(response.data).toEqual({ id: 1 });
    });

    test('should make PUT request', async () => {
      const mockResponse = createMockResponse({ jsonData: { updated: true } });

      mockFetch.mockResolvedValue(mockResponse);

      const putData = { id: 1, name: 'updated' };
      await client.put('/update/1', putData);

      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/update/1', {
        method: 'PUT',
        headers: {
          'User-Agent': 'test-client',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(putData),
        signal: expect.any(AbortSignal),
      });
    });

    test('should make DELETE request', async () => {
      const mockResponse = createMockResponse({ textData: '' });

      mockFetch.mockResolvedValue(mockResponse);

      await client.delete('/delete/1');

      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/delete/1', {
        method: 'DELETE',
        headers: { 'User-Agent': 'test-client' },
        signal: expect.any(AbortSignal),
      });
    });
  });

  describe('URL Building', () => {
    test('should build absolute URLs correctly', async () => {
      const mockResponse = createMockResponse({ jsonData: {} });

      mockFetch.mockResolvedValue(mockResponse);

      await client.get('/api/v1/test');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/v1/test',
        expect.any(Object),
      );
    });

    test('should handle full URLs directly', async () => {
      const mockResponse = createMockResponse({ jsonData: {} });

      mockFetch.mockResolvedValue(mockResponse);

      await client.get('https://other-api.com/test');

      expect(mockFetch).toHaveBeenCalledWith('https://other-api.com/test', expect.any(Object));
    });

    test('should handle baseURL with trailing slash', async () => {
      const clientWithSlash = new HTTPClient({ baseURL: 'https://api.example.com/' });

      const mockResponse = createMockResponse({ jsonData: {} });

      mockFetch.mockResolvedValue(mockResponse);

      await clientWithSlash.get('/test');

      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/test', expect.any(Object));
    });

    test('should handle path without leading slash', async () => {
      const mockResponse = createMockResponse({ jsonData: {} });

      mockFetch.mockResolvedValue(mockResponse);

      await client.get('test');

      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/test', expect.any(Object));
    });
  });

  describe('Response Parsing', () => {
    test('should parse JSON responses', async () => {
      const mockResponse = createMockResponse({ jsonData: { message: 'success' } });

      mockFetch.mockResolvedValue(mockResponse);

      const response = await client.get('/test');

      expect(response.data).toEqual({ message: 'success' });
    });

    test('should parse text responses', async () => {
      const mockResponse = createMockResponse({ textData: 'plain text response' });

      mockFetch.mockResolvedValue(mockResponse);

      const response = await client.get('/test');

      expect(response.data).toBe('plain text response');
    });

    test('should handle malformed JSON gracefully', async () => {
      const mockResponse = createMockResponse({
        headers: { 'content-type': 'application/json' },
        shouldJsonFail: true,
      });

      mockFetch.mockResolvedValue(mockResponse);

      await expect(client.get('/test')).rejects.toThrow('Failed to parse JSON response');
    });

    test('should default to text parsing for unknown content types', async () => {
      const mockResponse = createMockResponse({
        headers: { 'content-type': 'application/unknown' },
        textData: 'unknown content',
      });

      mockFetch.mockResolvedValue(mockResponse);

      const response = await client.get('/test');

      expect(response.data).toBe('unknown content');
    });

    test('should handle parseResponse: false option', async () => {
      const mockResponse = createMockResponse({ jsonData: {} });

      mockFetch.mockResolvedValue(mockResponse);

      const response = await client.get('/test', { parseResponse: false });

      expect(response.data).toBe(mockResponse);
    });
  });

  describe('Error Handling', () => {
    test('should throw NetworkError for HTTP errors', async () => {
      const mockResponse = createMockResponse({ ok: false, status: 404, statusText: 'Not Found' });

      mockFetch.mockResolvedValue(mockResponse);

      await expect(client.get('/not-found')).rejects.toThrow(NetworkError);
      await expect(client.get('/not-found')).rejects.toThrow('HTTP 404: Not Found');
    });

    test('should throw RateLimitError for 429 status', async () => {
      const mockResponse = createMockResponse({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: { 'retry-after': '60' },
      });

      mockFetch.mockResolvedValue(mockResponse);

      await expect(client.get('/rate-limited')).rejects.toThrow(RateLimitError);
    });

    test('should throw TimeoutError on request timeout', async () => {
      const shortTimeoutClient = new HTTPClient({ timeout: 100 });

      // Mock fetch to reject with AbortError after a delay
      mockFetch.mockImplementation(() =>
        Promise.reject(
          Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }),
        ),
      );

      await expect(shortTimeoutClient.get('/slow')).rejects.toThrow(TimeoutError);
    });

    test('should handle fetch abortion', async () => {
      mockFetch.mockRejectedValue(
        Object.assign(new Error('The user aborted a request'), { name: 'AbortError' }),
      );

      await expect(client.get('/test')).rejects.toThrow(TimeoutError);
    });
  });

  describe('Rate Limit Detection', () => {
    test('should parse standard rate limit headers', async () => {
      const mockResponse = createMockResponse({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: {
          'x-rate-limit-limit': '100',
          'x-rate-limit-remaining': '0',
          'x-rate-limit-reset': '1640995200',
          'retry-after': '60',
        },
      });

      mockFetch.mockResolvedValue(mockResponse);

      try {
        await client.get('/test');
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitError);
        expect((error as RateLimitError).context).toBeDefined();
      }
    });

    test('should parse alternative rate limit headers', async () => {
      const mockResponse = createMockResponse({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: {
          'x-ratelimit-limit': '100',
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': '60', // seconds from now
        },
      });

      mockFetch.mockResolvedValue(mockResponse);

      try {
        await client.get('/test');
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitError);
      }
    });
  });

  describe('Retry Logic', () => {
    test('should retry on 5xx errors', async () => {
      const mockResponse = createMockResponse({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      mockFetch
        .mockResolvedValueOnce(mockResponse)
        .mockResolvedValueOnce(mockResponse)
        .mockResolvedValueOnce(
          createMockResponse({ ok: true, status: 200, jsonData: { success: true } }),
        );

      const response = await client.get('/test');

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(response.data).toEqual({ success: true });
    });

    test('should not retry on 4xx errors (except 429)', async () => {
      const mockResponse = createMockResponse({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      });

      mockFetch.mockResolvedValue(mockResponse);

      await expect(client.get('/test')).rejects.toThrow(NetworkError);
      expect(mockFetch).toHaveBeenCalledTimes(1); // No retries
    });

    test('should retry on network errors', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(
          createMockResponse({ ok: true, status: 200, jsonData: { success: true } }),
        );

      const response = await client.get('/test');

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(response.data).toEqual({ success: true });
    });

    test('should respect maxRetries option', async () => {
      const singleRetryClient = new HTTPClient({ retries: 1 });

      const mockResponse = createMockResponse({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      mockFetch.mockResolvedValue(mockResponse);

      await expect(singleRetryClient.get('/test')).rejects.toThrow(NetworkError);
      expect(mockFetch).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });

    test('should wait between retries', async () => {
      const startTime = Date.now();

      const mockResponse = createMockResponse({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      mockFetch.mockResolvedValue(mockResponse);

      try {
        await client.get('/test');
      } catch (error) {
        const endTime = Date.now();
        const duration = endTime - startTime;

        // Should have waited for retries (at least 100ms * 2 retries with exponential backoff)
        expect(duration).toBeGreaterThan(200);
      }
    });

    test('should implement exponential backoff with jitter', async () => {
      const delays: number[] = [];
      const originalSetTimeout = global.setTimeout;

      global.setTimeout = jest.fn((callback, delay) => {
        // Only track delays that are for retry logic (not timeout delays)
        if (delay && delay >= 75 && delay <= 1000) {
          delays.push(delay);
        }
        return originalSetTimeout(callback, 0); // Execute immediately for testing
      }) as any;

      const mockResponse = createMockResponse({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      mockFetch.mockResolvedValue(mockResponse);

      try {
        await client.get('/test');
      } catch (error) {
        // Should have exponential backoff: base * 2^attempt with jitter
        expect(delays.length).toBe(2);
        expect(delays[0]).toBeGreaterThan(75); // 100ms base with jitter
        expect(delays[0]).toBeLessThan(125);
        expect(delays[1]).toBeGreaterThan(150); // 200ms with jitter
        expect(delays[1]).toBeLessThan(250);
      }

      global.setTimeout = originalSetTimeout;
    });
  });

  describe('Custom Options', () => {
    test('should use custom timeout per request', async () => {
      const mockResponse = createMockResponse({ jsonData: {} });

      mockFetch.mockResolvedValue(mockResponse);

      await client.get('/test', { timeout: 10000 });

      // Can't easily test the timeout value, but ensure request was made
      expect(mockFetch).toHaveBeenCalled();
    });

    test('should merge custom headers with defaults', async () => {
      const mockResponse = createMockResponse({ jsonData: {} });

      mockFetch.mockResolvedValue(mockResponse);

      await client.get('/test', {
        headers: { 'Custom-Header': 'custom-value' },
      });

      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/test', {
        method: 'GET',
        headers: {
          'User-Agent': 'test-client',
          'Custom-Header': 'custom-value',
        },
        signal: expect.any(AbortSignal),
      });
    });

    test('should override default retries per request', async () => {
      const mockResponse = createMockResponse({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      mockFetch.mockResolvedValue(mockResponse);

      await expect(client.get('/test', { maxRetries: 0 })).rejects.toThrow(NetworkError);
      expect(mockFetch).toHaveBeenCalledTimes(1); // No retries
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty response body', async () => {
      const mockResponse = createMockResponse({ ok: true, status: 204, statusText: 'No Content' });

      mockFetch.mockResolvedValue(mockResponse);

      const response = await client.get('/test');

      expect(response.data).toBe('');
      expect(response.status).toBe(204);
    });

    test('should handle missing content-type header', async () => {
      const mockResponse = createMockResponse({ ok: true, status: 200, textData: 'default text' });

      mockFetch.mockResolvedValue(mockResponse);

      const response = await client.get('/test');

      expect(response.data).toBe('default text');
    });

    test('should handle string data in POST requests', async () => {
      const mockResponse = createMockResponse({ jsonData: {} });

      mockFetch.mockResolvedValue(mockResponse);

      await client.post('/test', 'raw string data');

      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/test', {
        method: 'POST',
        headers: {
          'User-Agent': 'test-client',
          'Content-Type': 'application/json',
        },
        body: 'raw string data',
        signal: expect.any(AbortSignal),
      });
    });

    test('should handle concurrent requests', async () => {
      const mockResponse = createMockResponse({ ok: true, status: 200, jsonData: { id: 1 } });

      mockFetch.mockResolvedValue(mockResponse);

      const requests = [client.get('/test1'), client.get('/test2'), client.get('/test3')];

      await Promise.all(requests);

      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('Default Configuration', () => {
    test('should work with minimal configuration', () => {
      const minimalClient = new HTTPClient();

      expect(minimalClient).toBeInstanceOf(HTTPClient);
    });

    test('should use default values when not specified', () => {
      const defaultClient = new HTTPClient();

      // Test that it doesn't throw and can make requests
      expect(defaultClient).toBeDefined();
    });
  });
});
