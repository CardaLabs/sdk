// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.BLOCKFROST_PROJECT_ID = 'test_project_id';
process.env.COINGECKO_API_KEY = 'test_coingecko_key';
process.env.TAPTOOLS_API_KEY = 'test_taptools_key';

// Global test utilities
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(a: number, b: number): R;
    }
  }
}

// Custom matchers
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});

// Global test setup
beforeEach(() => {
  // Reset environment variables or mocks if needed
  jest.clearAllTimers();
  jest.useRealTimers();
});

afterEach(() => {
  // Cleanup after each test
  jest.clearAllMocks();
});

// Mock fetch globally for HTTP client tests
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Silence console logs during tests unless explicitly testing them
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Restore console in specific tests if needed
export const restoreConsole = () => {
  global.console = originalConsole;
};

export {};
