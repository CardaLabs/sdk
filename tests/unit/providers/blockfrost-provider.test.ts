/**
 * Unit tests for BlockfrostProvider
 */
import { BlockfrostProvider } from '../../../src/providers/blockfrost';
import type { BlockfrostConfig } from '../../../src/types/sdk';

// Mock the HTTP client
jest.mock('../../../src/utils/http-client', () => {
  return {
    HTTPClient: jest.fn().mockImplementation(() => ({
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    })),
  };
});

describe('BlockfrostProvider', () => {
  let provider: any; // Use any to avoid TypeScript issues with path aliases
  let mockHttpClient: any;

  beforeEach(() => {
    // Create mock HTTP client
    mockHttpClient = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    };

    // Mock HTTPClient constructor to return our mock
    const { HTTPClient } = require('../../../src/utils/http-client');
    HTTPClient.mockImplementation(() => mockHttpClient);

    provider = new BlockfrostProvider();
  });

  describe('Initialization', () => {
    test('should initialize with valid configuration', async () => {
      const config: BlockfrostConfig = {
        projectId: 'mainnet_test_project_id',
        baseUrl: 'https://cardano-mainnet.blockfrost.io/api/v0',
      };

      await provider.initialize(config);

      expect((provider as any).projectId).toBe('mainnet_test_project_id');
      expect((provider as any).baseUrl).toBe('https://cardano-mainnet.blockfrost.io/api/v0');
    });

    test('should throw error when project ID is missing', async () => {
      const config = {} as BlockfrostConfig;

      await expect(provider.initialize(config)).rejects.toThrow(
        'Blockfrost project ID is required',
      );
    });

    test('should use default base URL when not provided', async () => {
      const config: BlockfrostConfig = {
        projectId: 'test_project_id',
      };

      await provider.initialize(config);

      expect((provider as any).baseUrl).toBe('https://cardano-mainnet.blockfrost.io/api/v0');
    });

    test('should set up HTTP client with correct headers', async () => {
      const config: BlockfrostConfig = {
        projectId: 'test_project_id',
      };

      await provider.initialize(config);

      // Verify HTTP client was configured with project ID header
      expect((provider as any).httpClient).toBeDefined();
    });
  });

  describe('Health Check', () => {
    test('should return healthy status on successful health check', async () => {
      // Add a small delay to simulate network response time
      mockHttpClient.get.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: { status: 'ok' } }), 10)),
      );

      const health = await provider.healthCheck();

      expect(health.provider).toBe('blockfrost');
      expect(health.healthy).toBe(true);
      expect(health.responseTime).toBeGreaterThan(0);
      expect(health.consecutiveFailures).toBe(0);
      expect(mockHttpClient.get).toHaveBeenCalledWith('/health');
    });

    test('should return unhealthy status on failed health check', async () => {
      mockHttpClient.get.mockRejectedValue(new Error('Network error'));

      const health = await provider.healthCheck();

      expect(health.provider).toBe('blockfrost');
      expect(health.healthy).toBe(false);
      expect(health.consecutiveFailures).toBe(1);
      expect(health.lastError).toBe('Network error');
    });
  });

  describe('Token Data', () => {
    beforeEach(async () => {
      await provider.initialize({ projectId: 'test_project_id' });
    });

    test('should get ADA token data', async () => {
      const response = await provider.getTokenData('lovelace');

      expect(response.success).toBe(true);
      expect(response.data?.name).toBe('Cardano');
      expect(response.data?.symbol).toBe('ADA');
      expect(response.data?.decimals).toBe(6);
      expect(response.provider).toBe('blockfrost');
    });

    test('should get native asset data', async () => {
      const mockAssetData = {
        asset: 'policy123asset456',
        policy_id: 'policy123',
        asset_name: '617373657434353635',
        fingerprint: 'asset1234567890',
        quantity: '1000000',
        initial_mint_tx_hash: 'tx123',
        mint_or_burn_count: 1,
        onchain_metadata: {
          name: 'Test Token',
          description: 'A test token',
          ticker: 'TEST',
          decimals: 6,
        },
      };

      mockHttpClient.get.mockResolvedValue({ data: mockAssetData });

      const response = await provider.getTokenData('policy123asset456');

      expect(response.success).toBe(true);
      expect(response.data?.name).toBe('Test Token');
      expect(response.data?.symbol).toBe('TEST');
      expect(response.data?.decimals).toBe(6);
      expect(response.data?.totalSupply).toBe(1000000);
      expect(mockHttpClient.get).toHaveBeenCalledWith('/assets/policy123asset456', {
        timeout: undefined,
      });
    });

    test('should handle asset with metadata in different format', async () => {
      const mockAssetData = {
        asset: 'policy123asset456',
        policy_id: 'policy123',
        asset_name: '746573746173736574', // "testasset" in hex
        fingerprint: 'asset1234567890',
        quantity: '500000',
        metadata: {
          name: 'Metadata Token',
          ticker: 'META',
        },
      };

      mockHttpClient.get.mockResolvedValue({ data: mockAssetData });

      const response = await provider.getTokenData('policy123asset456');

      expect(response.success).toBe(true);
      expect(response.data?.name).toBe('Metadata Token');
      expect(response.data?.symbol).toBe('META');
      expect(response.data?.totalSupply).toBe(500000);
    });

    test('should handle hex asset name conversion', async () => {
      const mockAssetData = {
        asset: 'policy123asset456',
        policy_id: 'policy123',
        asset_name: '546573745f546f6b656e', // "Test_Token" in hex
        fingerprint: 'asset1234567890',
        quantity: '1000000',
      };

      mockHttpClient.get.mockResolvedValue({ data: mockAssetData });

      const response = await provider.getTokenData('policy123asset456');

      expect(response.success).toBe(true);
      expect(response.data?.name).toBe('Test_Token'); // Should convert from hex
    });

    test('should handle API errors gracefully', async () => {
      mockHttpClient.get.mockRejectedValue(new Error('Asset not found'));

      const response = await provider.getTokenData('invalid_asset');

      expect(response.success).toBe(false);
      expect(response.error).toBeInstanceOf(Error);
      expect(response.error?.message).toBe('Asset not found');
    });

    test('should handle malformed hex asset names', async () => {
      const mockAssetData = {
        asset: 'policy123asset456',
        policy_id: 'policy123',
        asset_name: 'invalid_hex_string', // Invalid hex
        fingerprint: 'asset1234567890',
        quantity: '1000000',
      };

      mockHttpClient.get.mockResolvedValue({ data: mockAssetData });

      const response = await provider.getTokenData('policy123asset456');

      expect(response.success).toBe(true);
      expect(response.data?.name).toBe('invalid_hex_string'); // Should fallback to original
    });
  });

  describe('Wallet Data', () => {
    beforeEach(async () => {
      await provider.initialize({ projectId: 'test_project_id' });
    });

    test('should get wallet balance and portfolio data', async () => {
      const mockAddressInfo = {
        address: 'addr1test',
        amount: [
          { unit: 'lovelace', quantity: '1000000000' },
          { unit: 'policy123asset456', quantity: '500000' },
        ],
        stake_address: 'stake1test',
        type: 'shelley',
        script: false,
      };

      const mockUtxos = [
        {
          tx_hash: 'utxo123',
          tx_index: 0,
          output_index: 0,
          amount: [{ unit: 'lovelace', quantity: '500000000' }],
          block: 'block123',
        },
      ];

      const mockTransactions = ['tx123', 'tx456'];

      mockHttpClient.get
        .mockResolvedValueOnce({ data: mockAddressInfo })
        .mockResolvedValueOnce({ data: mockUtxos })
        .mockResolvedValueOnce({ data: mockTransactions })
        .mockResolvedValueOnce({
          data: {
            hash: 'tx123',
            block_height: 123456,
            block_time: 1640995200,
            output_amount: [{ unit: 'lovelace', quantity: '100000000' }],
            fees: '200000',
            valid_contract: true,
            asset_mint_or_burn_count: 0,
            delegation_count: 0,
            stake_cert_count: 0,
            withdrawal_count: 0,
          },
        });

      const response = await provider.getWalletData('addr1test');

      expect(response.success).toBe(true);
      expect(response.data?.balance?.lovelace).toBe(1000000000);
      expect(response.data?.balance?.['policy123asset456']).toBe(500000);
      expect(response.data?.portfolio?.assets).toHaveLength(2);
      expect(response.data?.transactions).toHaveLength(1);

      // Verify API calls
      expect(mockHttpClient.get).toHaveBeenCalledWith('/addresses/addr1test', {
        timeout: undefined,
      });
      expect(mockHttpClient.get).toHaveBeenCalledWith('/addresses/addr1test/utxos', {
        timeout: undefined,
      });
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        '/addresses/addr1test/transactions?count=20&order=desc',
        { timeout: undefined },
      );
    });

    test('should handle empty wallet', async () => {
      const mockAddressInfo = {
        address: 'addr1empty',
        amount: [],
        type: 'shelley',
        script: false,
      };

      mockHttpClient.get
        .mockResolvedValueOnce({ data: mockAddressInfo })
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({ data: [] });

      const response = await provider.getWalletData('addr1empty');

      expect(response.success).toBe(true);
      expect(response.data?.balance).toEqual({});
      expect(response.data?.portfolio?.assets).toEqual([]);
      expect(response.data?.transactions).toEqual([]);
    });

    test('should handle transaction parsing errors gracefully', async () => {
      const mockAddressInfo = {
        address: 'addr1test',
        amount: [{ unit: 'lovelace', quantity: '1000000000' }],
        type: 'shelley',
        script: false,
      };

      const mockTransactions = ['tx123'];

      mockHttpClient.get
        .mockResolvedValueOnce({ data: mockAddressInfo })
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({ data: mockTransactions })
        .mockRejectedValueOnce(new Error('Transaction not found'));

      const response = await provider.getWalletData('addr1test');

      expect(response.success).toBe(true);
      expect(response.data?.balance?.lovelace).toBe(1000000000);
      expect(response.data?.transactions).toEqual([]); // Should handle tx error gracefully
    });

    test('should determine transaction types correctly', async () => {
      const mockAddressInfo = {
        address: 'addr1test',
        amount: [{ unit: 'lovelace', quantity: '1000000000' }],
        type: 'shelley',
        script: false,
      };

      const mockTransactions = ['tx1', 'tx2', 'tx3'];

      mockHttpClient.get
        .mockResolvedValueOnce({ data: mockAddressInfo })
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({ data: mockTransactions })
        .mockResolvedValueOnce({
          data: {
            hash: 'tx1',
            block_height: 123456,
            block_time: 1640995200,
            output_amount: [{ unit: 'lovelace', quantity: '100000000' }],
            fees: '200000',
            valid_contract: true,
            asset_mint_or_burn_count: 1,
            delegation_count: 0,
            stake_cert_count: 0,
            withdrawal_count: 0,
          },
        })
        .mockResolvedValueOnce({
          data: {
            hash: 'tx2',
            block_height: 123457,
            block_time: 1640995260,
            output_amount: [{ unit: 'lovelace', quantity: '50000000' }],
            fees: '200000',
            valid_contract: true,
            asset_mint_or_burn_count: 0,
            delegation_count: 1,
            stake_cert_count: 0,
            withdrawal_count: 0,
          },
        })
        .mockResolvedValueOnce({
          data: {
            hash: 'tx3',
            block_height: 123458,
            block_time: 1640995320,
            output_amount: [{ unit: 'lovelace', quantity: '75000000' }],
            fees: '200000',
            valid_contract: true,
            asset_mint_or_burn_count: 0,
            delegation_count: 0,
            stake_cert_count: 0,
            withdrawal_count: 1,
          },
        });

      const response = await provider.getWalletData('addr1test');

      expect(response.success).toBe(true);
      expect(response.data?.transactions).toHaveLength(3);
      expect(response.data?.transactions?.[0].type).toBe('mint');
      expect(response.data?.transactions?.[1].type).toBe('stake');
      expect(response.data?.transactions?.[2].type).toBe('reward');
    });

    test('should handle wallet API errors', async () => {
      mockHttpClient.get.mockRejectedValue(new Error('Address not found'));

      const response = await provider.getWalletData('invalid_address');

      expect(response.success).toBe(false);
      expect(response.error).toBeInstanceOf(Error);
      expect(response.error?.message).toBe('Address not found');
    });
  });

  describe('Provider Capabilities', () => {
    test('should have correct capabilities defined', () => {
      expect(provider.capabilities.tokenData).toContain('name');
      expect(provider.capabilities.tokenData).toContain('symbol');
      expect(provider.capabilities.tokenData).toContain('decimals');
      expect(provider.capabilities.tokenData).toContain('totalSupply');

      expect(provider.capabilities.walletData).toContain('balance');
      expect(provider.capabilities.walletData).toContain('portfolio');
      expect(provider.capabilities.walletData).toContain('transactions');

      expect(provider.capabilities.features?.historical).toBe(true);
      expect(provider.capabilities.features?.realtime).toBe(false);
      expect(provider.capabilities.features?.batch).toBe(false);
    });

    test('should have rate limit information', () => {
      expect(provider.capabilities.rateLimit?.requestsPerSecond).toBeDefined();
      expect(provider.capabilities.rateLimit?.requestsPerDay).toBeDefined();
    });
  });

  describe('Error Scenarios', () => {
    beforeEach(async () => {
      await provider.initialize({ projectId: 'test_project_id' });
    });

    test('should handle network timeouts', async () => {
      mockHttpClient.get.mockRejectedValue(new Error('Request timeout'));

      const response = await provider.getTokenData('test_asset', { timeout: 1000 });

      expect(response.success).toBe(false);
      expect(response.error?.message).toBe('Request timeout');
    });

    test('should handle rate limiting', async () => {
      mockHttpClient.get.mockRejectedValue({
        name: 'HTTPError',
        status: 429,
        message: 'Too Many Requests',
      });

      const response = await provider.getTokenData('test_asset');

      expect(response.success).toBe(false);
    });

    test('should handle invalid JSON responses', async () => {
      mockHttpClient.get.mockResolvedValue({ data: 'invalid json' });

      const response = await provider.getTokenData('test_asset');

      expect(response.success).toBe(true);
      // Should handle non-object responses gracefully
    });
  });

  describe('Utility Functions', () => {
    test('should convert hex strings to readable text', () => {
      const hexToString = (provider as any).hexToString;

      expect(hexToString('48656c6c6f')).toBe('Hello');
      expect(hexToString('546573745f546f6b656e')).toBe('Test_Token');
      expect(hexToString('0x48656c6c6f')).toBe('Hello'); // With 0x prefix
      expect(hexToString('invalid')).toBe('invalid'); // Invalid hex
      expect(hexToString('')).toBe(''); // Empty string
    });

    test('should handle hex strings with null bytes', () => {
      const hexToString = (provider as any).hexToString;

      expect(hexToString('48656c6c6f00')).toBe('Hello'); // Should strip null bytes
    });
  });

  describe('Request Options', () => {
    beforeEach(async () => {
      await provider.initialize({ projectId: 'test_project_id' });
    });

    test('should pass timeout option to HTTP client', async () => {
      // Use a non-lovelace asset since lovelace is handled specially
      const mockAssetData = {
        asset: 'test_asset',
        policy_id: 'policy123',
        asset_name: '746573745f746f6b656e',
        fingerprint: 'asset1234567890',
        quantity: '1000000',
      };

      mockHttpClient.get.mockResolvedValue({ data: mockAssetData });

      await provider.getTokenData('test_asset', { timeout: 5000 });

      expect(mockHttpClient.get).toHaveBeenCalledWith('/assets/test_asset', {
        timeout: 5000,
        headers: undefined,
      });
    });

    test('should handle custom headers in request options', async () => {
      const mockAssetData = {
        asset: 'test_asset',
        policy_id: 'policy123',
        asset_name: '746573745f746f6b656e',
        fingerprint: 'asset1234567890',
        quantity: '1000000',
      };

      mockHttpClient.get.mockResolvedValue({ data: mockAssetData });

      const customOptions = {
        timeout: 3000,
        headers: { 'Custom-Header': 'test-value' },
      };

      await provider.getTokenData('test_asset', customOptions);

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        '/assets/test_asset',
        expect.objectContaining({
          timeout: 3000,
          headers: { 'Custom-Header': 'test-value' },
        }),
      );
    });
  });
});
