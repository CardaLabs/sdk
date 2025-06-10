import { BaseProvider } from '@/providers/base/provider.interface';
import type { ProviderRequestOptions } from '@/providers/base/request-options';
import type { AssetUnit, CardanoAddress, TokenData, WalletData } from '@/types/common';
import { ValidationError } from '@/types/errors';
import type { ProviderResponse } from '@/types/providers';
import type { CoingeckoConfig, ProviderCapabilities, ProviderHealth } from '@/types/sdk';
import { HTTPClient } from '@/utils/http-client';

interface CoinGeckoCoin {
  id: string;
  symbol: string;
  name: string;
  image?: {
    thumb?: string;
    small?: string;
    large?: string;
  };
  market_data?: {
    current_price?: { [currency: string]: number };
    market_cap?: { [currency: string]: number };
    total_volume?: { [currency: string]: number };
    high_24h?: { [currency: string]: number };
    low_24h?: { [currency: string]: number };
    price_change_24h?: number;
    price_change_percentage_24h?: number;
    price_change_percentage_7d?: number;
    price_change_percentage_30d?: number;
    market_cap_change_24h?: number;
    market_cap_change_percentage_24h?: number;
    total_supply?: number;
    max_supply?: number;
    circulating_supply?: number;
    ath?: { [currency: string]: number };
    atl?: { [currency: string]: number };
    ath_date?: { [currency: string]: string };
    atl_date?: { [currency: string]: string };
    last_updated?: string;
  };
  description?: {
    en?: string;
  };
}

interface CoinGeckoSimplePrice {
  [coinId: string]: {
    [currency: string]: number;
  };
}

interface CoinGeckoMarketData {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  fully_diluted_valuation?: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  market_cap_change_24h: number;
  market_cap_change_percentage_24h: number;
  circulating_supply: number;
  total_supply?: number;
  max_supply?: number;
  ath: number;
  ath_change_percentage: number;
  ath_date: string;
  atl: number;
  atl_change_percentage: number;
  atl_date: string;
  last_updated: string;
  price_change_percentage_7d_in_currency?: number;
  price_change_percentage_30d_in_currency?: number;
}

const CARDANO_COIN_MAPPINGS: Record<string, string> = {
  lovelace: 'cardano',
  // Add more asset mappings as needed
  // These would need to be configured based on actual CoinGecko IDs
};

export class CoinGeckoProvider extends BaseProvider {
  readonly name = 'coingecko';
  readonly version = '1.0.0';
  readonly capabilities: ProviderCapabilities = {
    tokenData: [
      'price',
      'priceUsd',
      'marketCap',
      'marketCapUsd',
      'volume24h',
      'volume24hUsd',
      'priceChange24h',
      'priceChangePercentage24h',
      'priceChange7d',
      'priceChangePercentage7d',
      'priceChange30d',
      'priceChangePercentage30d',
      'high24h',
      'low24h',
      'ath',
      'atl',
      'athDate',
      'atlDate',
      'totalSupply',
      'circulatingSupply',
      'maxSupply',
      'name',
      'symbol',
      'description',
      'logo',
    ],
    walletData: [], // CoinGecko doesn't provide wallet data
    features: {
      batch: true,
      realtime: false,
      historical: true,
    },
    rateLimit: {
      requestsPerMinute: 50, // Free tier limit
    },
  };

  private httpClient: HTTPClient;
  private apiKey?: string;
  private isPro: boolean;
  private baseUrl: string;

  constructor() {
    super();
    this.httpClient = new HTTPClient();
    this.isPro = false;
    this.baseUrl = 'https://api.coingecko.com/api/v3';
  }

  protected async onInitialize(): Promise<void> {
    const config = this.config as unknown as CoingeckoConfig;

    this.apiKey = config.apiKey;
    this.isPro = config.pro ?? false;
    this.baseUrl =
      config.baseUrl ??
      (this.isPro ? 'https://pro-api.coingecko.com/api/v3' : 'https://api.coingecko.com/api/v3');

    // Configure HTTP client
    const headers: Record<string, string> = {
      'User-Agent': 'cardalabs/1.0.0',
    };

    if (this.apiKey) {
      headers['x-cg-pro-api-key'] = this.apiKey;
    }

    this.httpClient = new HTTPClient({
      baseURL: this.baseUrl,
      headers,
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
      // Test with a simple ping
      await this.httpClient.get('/ping');

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
      // Get CoinGecko coin ID for the asset
      const coinId = this.getCoinId(assetUnit);

      if (!coinId) {
        return {
          success: false,
          error: new Error(`No CoinGecko mapping found for asset: ${assetUnit}`),
          provider: this.name,
          timestamp: new Date(),
        };
      }

      // Get detailed coin data
      const response = await this.httpClient.get<CoinGeckoCoin>(`/coins/${coinId}`, {
        timeout: options?.timeout,
        headers: options?.headers,
      });

      const coin = response.data;
      const marketData = coin.market_data;

      if (!marketData) {
        return {
          success: false,
          error: new Error(`No market data available for ${coinId}`),
          provider: this.name,
          timestamp: new Date(),
        };
      }

      // Parse the token data
      const tokenData: Partial<TokenData> = {
        name: coin.name,
        symbol: coin.symbol?.toUpperCase(),
        description: coin.description?.en,
        logo: coin.image?.large || coin.image?.small || coin.image?.thumb,

        // Price data (USD as primary)
        price: marketData.current_price?.usd,
        priceUsd: marketData.current_price?.usd,

        // Market data
        marketCap: marketData.market_cap?.usd,
        marketCapUsd: marketData.market_cap?.usd,
        volume24h: marketData.total_volume?.usd,
        volume24hUsd: marketData.total_volume?.usd,

        // Price changes
        priceChange24h: marketData.price_change_24h,
        priceChangePercentage24h: marketData.price_change_percentage_24h,
        priceChangePercentage7d: marketData.price_change_percentage_7d,
        priceChangePercentage30d: marketData.price_change_percentage_30d,

        // High/Low
        high24h: marketData.high_24h?.usd,
        low24h: marketData.low_24h?.usd,

        // All-time high/low
        ath: marketData.ath?.usd,
        atl: marketData.atl?.usd,
        athDate: marketData.ath_date?.usd ? new Date(marketData.ath_date.usd) : undefined,
        atlDate: marketData.atl_date?.usd ? new Date(marketData.atl_date.usd) : undefined,

        // Supply data
        totalSupply: marketData.total_supply,
        circulatingSupply: marketData.circulating_supply,
        maxSupply: marketData.max_supply,

        // Metadata
        dataSource: [this.name],
        lastUpdated: marketData.last_updated ? new Date(marketData.last_updated) : new Date(),
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
    // CoinGecko doesn't provide wallet data
    return {
      success: false,
      error: new Error('CoinGecko provider does not support wallet data'),
      provider: this.name,
      timestamp: new Date(),
    };
  }

  /**
   * Get simple price data for multiple assets (batch request)
   */
  async getTokenDataBatch(
    assetUnits: AssetUnit[],
    options?: ProviderRequestOptions,
  ): Promise<ProviderResponse<Record<AssetUnit, Partial<TokenData>>>> {
    this.ensureInitialized();

    try {
      // Map asset units to CoinGecko IDs
      const coinIds: string[] = [];
      const assetToCoinId: Record<AssetUnit, string> = {};

      for (const assetUnit of assetUnits) {
        const coinId = this.getCoinId(assetUnit);
        if (coinId) {
          coinIds.push(coinId);
          assetToCoinId[assetUnit] = coinId;
        }
      }

      if (coinIds.length === 0) {
        return {
          success: false,
          error: new Error('No valid CoinGecko mappings found for provided assets'),
          provider: this.name,
          timestamp: new Date(),
        };
      }

      // Get market data for all coins
      const response = await this.httpClient.get<CoinGeckoMarketData[]>(
        `/coins/markets?vs_currency=usd&ids=${coinIds.join(',')}&order=market_cap_desc&per_page=${coinIds.length}&page=1&sparkline=false&price_change_percentage=7d,30d`,
        {
          timeout: options?.timeout,
          headers: options?.headers,
        },
      );

      const results: Record<AssetUnit, Partial<TokenData>> = {};

      // Map results back to asset units
      for (const [assetUnit, coinId] of Object.entries(assetToCoinId)) {
        const marketData = response.data.find((coin) => coin.id === coinId);

        if (marketData) {
          results[assetUnit] = {
            name: marketData.name,
            symbol: marketData.symbol?.toUpperCase(),
            logo: marketData.image,
            price: marketData.current_price,
            priceUsd: marketData.current_price,
            marketCap: marketData.market_cap,
            marketCapUsd: marketData.market_cap,
            volume24h: marketData.total_volume,
            volume24hUsd: marketData.total_volume,
            priceChange24h: marketData.price_change_24h,
            priceChangePercentage24h: marketData.price_change_percentage_24h,
            priceChangePercentage7d: marketData.price_change_percentage_7d_in_currency,
            priceChangePercentage30d: marketData.price_change_percentage_30d_in_currency,
            high24h: marketData.high_24h,
            low24h: marketData.low_24h,
            ath: marketData.ath,
            atl: marketData.atl,
            athDate: new Date(marketData.ath_date),
            atlDate: new Date(marketData.atl_date),
            totalSupply: marketData.total_supply,
            circulatingSupply: marketData.circulating_supply,
            maxSupply: marketData.max_supply,
            dataSource: [this.name],
            lastUpdated: new Date(marketData.last_updated),
          };
        }
      }

      return {
        success: true,
        data: results,
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

  /**
   * Map asset unit to CoinGecko coin ID
   */
  private getCoinId(assetUnit: AssetUnit): string | null {
    // Check predefined mappings
    if (CARDANO_COIN_MAPPINGS[assetUnit]) {
      return CARDANO_COIN_MAPPINGS[assetUnit];
    }

    // For other assets, we would need a more sophisticated mapping system
    // This could involve:
    // 1. A database of policy ID -> CoinGecko ID mappings
    // 2. API calls to search for assets by name/symbol
    // 3. User-provided mappings in configuration

    return null;
  }

  /**
   * Add custom asset mapping
   */
  addAssetMapping(assetUnit: AssetUnit, coinGeckoId: string): void {
    CARDANO_COIN_MAPPINGS[assetUnit] = coinGeckoId;
  }

  /**
   * Get available currency options for price data
   */
  async getSupportedCurrencies(): Promise<string[]> {
    try {
      const response = await this.httpClient.get<string[]>('/simple/supported_vs_currencies');
      return response.data;
    } catch (error) {
      return ['usd', 'eur', 'btc']; // Default currencies
    }
  }
}
