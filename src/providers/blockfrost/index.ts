import { BaseProvider } from '@/providers/base/provider.interface';
import type { ProviderRequestOptions } from '@/providers/base/request-options';
import type {
  AssetUnit,
  CardanoAddress,
  PortfolioAsset,
  TokenData,
  TransactionAsset,
  TransactionData,
  TransactionType,
  WalletData,
} from '@/types/common';
import { ValidationError } from '@/types/errors';
import type { ProviderResponse } from '@/types/providers';
import type { BlockfrostConfig, ProviderCapabilities, ProviderHealth } from '@/types/sdk';
import { HTTPClient } from '@/utils/http-client';

interface BlockfrostAsset {
  asset: string;
  policy_id: string;
  asset_name: string;
  fingerprint: string;
  quantity: string;
  initial_mint_tx_hash: string;
  mint_or_burn_count: number;
  onchain_metadata?: {
    name?: string;
    description?: string;
    ticker?: string;
    url?: string;
    logo?: string;
    decimals?: number;
  };
  metadata?: {
    name?: string;
    description?: string;
    ticker?: string;
    url?: string;
    logo?: string;
    decimals?: number;
  };
}

interface BlockfrostAddressInfo {
  address: string;
  amount: Array<{
    unit: string;
    quantity: string;
  }>;
  stake_address?: string;
  type: string;
  script: boolean;
}

interface BlockfrostAddressUTXO {
  tx_hash: string;
  tx_index: number;
  output_index: number;
  amount: Array<{
    unit: string;
    quantity: string;
  }>;
  block: string;
  data_hash?: string;
}

interface BlockfrostTransaction {
  hash: string;
  block: string;
  block_height: number;
  block_time: number;
  slot: number;
  index: number;
  output_amount: Array<{
    unit: string;
    quantity: string;
  }>;
  fees: string;
  deposit: string;
  size: number;
  invalid_before?: string;
  invalid_hereafter?: string;
  utxo_count: number;
  withdrawal_count: number;
  mir_cert_count: number;
  delegation_count: number;
  stake_cert_count: number;
  pool_update_count: number;
  pool_retire_count: number;
  asset_mint_or_burn_count: number;
  redeemer_count: number;
  valid_contract: boolean;
}

export class BlockfrostProvider extends BaseProvider {
  readonly name = 'blockfrost';
  readonly version = '1.0.0';
  readonly capabilities: ProviderCapabilities = {
    tokenData: [
      'name',
      'symbol',
      'decimals',
      'description',
      'logo',
      'totalSupply',
      'circulatingSupply',
    ],
    walletData: ['balance', 'portfolio', 'transactions'],
    features: {
      batch: false,
      realtime: false,
      historical: true,
    },
    rateLimit: {
      requestsPerSecond: 10,
      requestsPerDay: 100000,
    },
  };

  private httpClient: HTTPClient;
  private projectId: string;
  private baseUrl: string;

  constructor() {
    super();
    this.httpClient = new HTTPClient();
    this.projectId = '';
    this.baseUrl = 'https://cardano-mainnet.blockfrost.io/api/v0';
  }

  protected async onInitialize(): Promise<void> {
    const config = this.config as unknown as BlockfrostConfig;

    if (!config.projectId) {
      throw new ValidationError('Blockfrost project ID is required');
    }

    this.projectId = config.projectId;
    this.baseUrl = config.baseUrl ?? 'https://cardano-mainnet.blockfrost.io/api/v0';

    // Configure HTTP client with Blockfrost headers
    this.httpClient = new HTTPClient({
      baseURL: this.baseUrl,
      headers: {
        project_id: this.projectId,
        'User-Agent': 'cardalabs/1.0.0',
      },
      timeout: 10000,
      retries: 3,
    });
  }

  protected async onDestroy(): Promise<void> {
    // Clean up any resources
  }

  async healthCheck(): Promise<ProviderHealth> {
    const startTime = Date.now();

    try {
      // Test the health endpoint
      await this.httpClient.get('/health');

      return {
        provider: this.name,
        healthy: true,
        lastCheck: new Date(),
        consecutiveFailures: 0,
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        provider: this.name,
        healthy: false,
        lastCheck: new Date(),
        consecutiveFailures: 1,
        lastError: (error as Error).message,
        responseTime: Date.now() - startTime,
      };
    }
  }

  async getTokenData(
    assetUnit: AssetUnit,
    options?: ProviderRequestOptions,
  ): Promise<ProviderResponse<Partial<TokenData>>> {
    this.ensureInitialized();

    try {
      // Handle ADA (lovelace) specially
      if (assetUnit === 'lovelace') {
        return {
          success: true,
          data: {
            name: 'Cardano',
            symbol: 'ADA',
            decimals: 6,
            description: 'Cardano native token',
            dataSource: [this.name],
            lastUpdated: new Date(),
          },
          provider: this.name,
          timestamp: new Date(),
        };
      }

      // Get asset information
      const response = await this.httpClient.get<BlockfrostAsset>(`/assets/${assetUnit}`, {
        timeout: options?.timeout,
        headers: options?.headers,
      });

      const asset = response.data;
      const metadata = asset.onchain_metadata || asset.metadata || {};

      const tokenData: Partial<TokenData> = {
        name: metadata.name || this.hexToString(asset.asset_name),
        symbol: metadata.ticker || this.hexToString(asset.asset_name),
        decimals: metadata.decimals || 0,
        description: metadata.description,
        logo: metadata.logo || metadata.url,
        totalSupply: parseInt(asset.quantity, 10),
        circulatingSupply: parseInt(asset.quantity, 10),
        dataSource: [this.name],
        lastUpdated: new Date(),
      };

      return {
        success: true,
        data: tokenData,
        provider: this.name,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        provider: this.name,
        timestamp: new Date(),
      };
    }
  }

  async getWalletData(
    address: CardanoAddress,
    options?: ProviderRequestOptions,
  ): Promise<ProviderResponse<Partial<WalletData>>> {
    this.ensureInitialized();

    try {
      // Get address information
      const [addressInfo, utxos, transactions] = await Promise.all([
        this.getAddressInfo(address, options),
        this.getAddressUTXOs(address, options),
        this.getAddressTransactions(address, options),
      ]);

      const walletData: Partial<WalletData> = {
        balance: this.parseBalance(addressInfo.amount),
        portfolio: this.buildPortfolio(addressInfo.amount),
        transactions: transactions.slice(0, 10), // Latest 10 transactions
        dataSource: [this.name],
        lastUpdated: new Date(),
      };

      return {
        success: true,
        data: walletData,
        provider: this.name,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        provider: this.name,
        timestamp: new Date(),
      };
    }
  }

  private async getAddressInfo(
    address: string,
    options?: ProviderRequestOptions,
  ): Promise<BlockfrostAddressInfo> {
    const response = await this.httpClient.get<BlockfrostAddressInfo>(`/addresses/${address}`, {
      timeout: options?.timeout,
      headers: options?.headers,
    });
    return response.data;
  }

  private async getAddressUTXOs(
    address: string,
    options?: ProviderRequestOptions,
  ): Promise<BlockfrostAddressUTXO[]> {
    const response = await this.httpClient.get<BlockfrostAddressUTXO[]>(
      `/addresses/${address}/utxos`,
      {
        timeout: options?.timeout,
        headers: options?.headers,
      },
    );
    return response.data;
  }

  private async getAddressTransactions(
    address: string,
    options?: ProviderRequestOptions,
  ): Promise<TransactionData[]> {
    try {
      const response = await this.httpClient.get<string[]>(
        `/addresses/${address}/transactions?count=20&order=desc`,
        {
          timeout: options?.timeout,
          headers: options?.headers,
        },
      );

      // Get transaction details for each hash
      const txDetails = await Promise.all(
        response.data.slice(0, 10).map(async (txHash) => {
          try {
            const txResponse = await this.httpClient.get<BlockfrostTransaction>(`/txs/${txHash}`, {
              timeout: options?.timeout,
              headers: options?.headers,
            });
            return this.parseTransaction(txResponse.data, address);
          } catch (error) {
            // Skip failed transaction details
            return null;
          }
        }),
      );

      return txDetails.filter((tx): tx is TransactionData => tx !== null);
    } catch (error) {
      // Return empty array if transactions can't be fetched
      return [];
    }
  }

  private parseBalance(amounts: Array<{ unit: string; quantity: string }>): Record<string, number> {
    const balance: Record<string, number> = {};

    for (const amount of amounts) {
      balance[amount.unit] = parseInt(amount.quantity, 10);
    }

    return balance;
  }

  private buildPortfolio(amounts: Array<{ unit: string; quantity: string }>): {
    assets: PortfolioAsset[];
  } {
    const assets: PortfolioAsset[] = amounts.map((amount) => ({
      assetUnit: amount.unit,
      name: amount.unit === 'lovelace' ? 'Cardano' : undefined,
      symbol: amount.unit === 'lovelace' ? 'ADA' : undefined,
      balance: parseInt(amount.quantity, 10),
    }));

    return { assets };
  }

  private parseTransaction(tx: BlockfrostTransaction, address: string): TransactionData {
    // Determine transaction type and amounts
    const adaAmount = tx.output_amount.find((a) => a.unit === 'lovelace');
    const assets: TransactionAsset[] = tx.output_amount
      .filter((a) => a.unit !== 'lovelace')
      .map((a) => ({
        assetUnit: a.unit,
        amount: parseInt(a.quantity, 10),
        direction: 'in' as const, // Simplified - would need UTXOs to determine actual direction
      }));

    return {
      hash: tx.hash,
      blockHeight: tx.block_height,
      timestamp: new Date(tx.block_time * 1000),
      type: this.determineTransactionType(tx),
      amount: adaAmount ? parseInt(adaAmount.quantity, 10) : 0,
      fee: parseInt(tx.fees, 10),
      status: tx.valid_contract ? 'confirmed' : 'failed',
      assets: assets.length > 0 ? assets : undefined,
    };
  }

  private determineTransactionType(tx: BlockfrostTransaction): TransactionType {
    if (tx.asset_mint_or_burn_count > 0) {
      return 'mint';
    }
    if (tx.delegation_count > 0 || tx.stake_cert_count > 0) {
      return 'stake';
    }
    if (tx.withdrawal_count > 0) {
      return 'reward';
    }
    return 'send'; // Default to send
  }

  private hexToString(hex: string): string {
    try {
      // Handle empty string
      if (!hex) {
        return hex;
      }

      // Remove hex prefix if present
      const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;

      // Check if it's valid hex (even length and only hex characters)
      if (cleanHex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(cleanHex)) {
        return hex; // Return original if not valid hex
      }

      // Convert hex to string
      let result = '';
      for (let i = 0; i < cleanHex.length; i += 2) {
        const charCode = parseInt(cleanHex.substr(i, 2), 16);
        if (charCode > 0) {
          // Skip null bytes
          result += String.fromCharCode(charCode);
        }
      }

      // Return result if not empty, otherwise return original
      return result || hex;
    } catch {
      return hex; // Return original on any error
    }
  }
}
