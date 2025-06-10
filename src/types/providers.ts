/**
 * Provider-specific types and interfaces
 * These types represent the raw responses from external APIs before normalization
 */

/**
 * Blockfrost API response types
 */
export interface BlockfrostAddressInfo {
  address: string;
  amount: Array<{
    unit: string;
    quantity: string;
    decimals: number | null;
    has_nft_onchain_metadata: boolean;
  }>;
  stake_address: string;
  type: string;
  script: boolean;
}

export interface BlockfrostAddressTotalInfo {
  address: string;
  received_sum: Array<{
    unit: string;
    quantity: string;
  }>;
  sent_sum: Array<{
    unit: string;
    quantity: string;
  }>;
  tx_count: number;
}

export interface BlockfrostAssetInfo {
  asset: string;
  policy_id: string;
  asset_name: string | null;
  fingerprint: string;
  quantity: string;
  initial_mint_tx_hash: string;
  mint_or_burn_count: string;
  onchain_metadata: Record<string, unknown> | null;
  onchain_metadata_standard: string | null;
  onchain_metadata_extra: string | null;
  metadata: {
    name?: string;
    description?: string;
    ticker?: string | null;
    url?: string | null;
    logo?: string | null;
    decimals?: number | null;
  } | null;
}

export interface BlockfrostUtxo {
  address: string;
  tx_hash: string;
  output_index: number;
  amount: Array<{
    unit: string;
    quantity: string;
  }>;
  block: string;
  data_hash: string | null;
  inline_datum: string | null;
  reference_script_hash: string | null;
}

/**
 * CoinGecko API response types
 */
export interface CoingeckoTokenPrice {
  [address: string]: {
    usd: number;
    usd_market_cap?: number;
    usd_24h_vol?: number;
    usd_24h_change?: number;
  };
}

export interface CoingeckoTokenInfo {
  id: string;
  symbol: string;
  name: string;
  description: {
    en: string;
  };
  image: {
    thumb: string;
    small: string;
    large: string;
  };
  genesis_date: string | null;
  market_cap_rank: number | null;
  market_data: {
    current_price: { usd: number };
    ath: { usd: number };
    ath_date: { usd: string };
    atl: { usd: number };
    atl_date: { usd: string };
    market_cap: { usd: number };
    fully_diluted_valuation: { usd: number };
    total_volume: { usd: number };
    high_24h: { usd: number };
    low_24h: { usd: number };
    price_change_24h: number;
    price_change_percentage_24h: number;
    price_change_percentage_7d: number;
    price_change_percentage_30d: number;
    price_change_percentage_60d: number;
    price_change_percentage_200d: number;
    price_change_percentage_1y: number;
    market_cap_change_24h: number;
    market_cap_change_percentage_24h: number;
    total_supply: number;
    max_supply: number;
    max_supply_infinite: boolean;
    circulating_supply: number;
  };
}

/**
 * TapTools API response types
 */
export interface TaptoolsTokenPrice {
  [unit: string]: number;
}

export interface TaptoolsTokenMarketCap {
  ticker: string;
  circSupply: number;
  totalSupply: number;
  price: number;
  mcap: number;
  fdv: number;
}

export interface TaptoolsTokenHolders {
  holders: number;
}

export interface TaptoolsTokenHolder {
  address: string;
  amount: number;
}

export interface TaptoolsTradingStats {
  buyers: number;
  sellers: number;
  buyVolume: number;
  sellVolume: number;
  buys: number;
  sells: number;
}

export interface TaptoolsTopToken {
  unit: string;
  ticker: string;
  price: number;
  liquidity?: number;
  mcap?: number;
  fdv?: number;
  circSupply?: number;
  totalSupply?: number;
  volume?: number;
}

export interface TaptoolsPortfolioPositions {
  adaValue: number;
  adaBalance: number;
  numFTs: number;
  numNFTs: number;
  liquidValue: number;
  positionsFt: Array<{
    ticker: string;
    balance: number;
    unit: string;
    fingerprint: string;
    price: number;
    adaValue: number;
    '24h': number;
    '7d': number;
    '30d': number;
    liquidBalance: number;
    liquidValue: number;
  }>;
  positionsNft: Array<{
    name: string;
    policy: string;
    balance: number;
    adaValue: number;
    floorPrice: number;
    '24h': number;
    '7d': number;
    '30d': number;
    listings: number;
    liquidValue: number;
  }>;
  positionsLp: Array<{
    ticker: string;
    unit: string;
    amountLP: number;
    tokenA: string;
    tokenAName: string;
    tokenAAmount: number;
    tokenB: string;
    tokenBName: string;
    tokenBAmount: number;
    adaValue: number;
    exchange: string;
  }>;
}

export interface TaptoolsPortfolioTrend {
  time: number;
  value: number;
}

/**
 * DexScreener API response types
 */
export interface DexscreenerPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd?: string;
  txns: {
    m5: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  volume: {
    h24: number;
    h6: number;
    h1: number;
    m5: number;
  };
  priceChange: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  liquidity?: {
    usd?: number;
    base: number;
    quote: number;
  };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
}

export interface DexscreenerResponse {
  schemaVersion: string;
  pairs: DexscreenerPair[] | null;
}

/**
 * CoinMarketCap API response types
 */
export interface CoinmarketcapQuote {
  [id: string]: {
    id: number;
    name: string;
    symbol: string;
    slug: string;
    num_market_pairs: number;
    date_added: string;
    tags: string[];
    max_supply: number | null;
    circulating_supply: number;
    total_supply: number;
    is_active: number;
    platform: {
      id: number;
      name: string;
      symbol: string;
      slug: string;
      token_address: string;
    } | null;
    cmc_rank: number;
    is_fiat: number;
    self_reported_circulating_supply: number | null;
    self_reported_market_cap: number | null;
    tvl_ratio: number | null;
    last_updated: string;
    quote: {
      USD: {
        price: number;
        volume_24h: number;
        volume_change_24h: number;
        percent_change_1h: number;
        percent_change_24h: number;
        percent_change_7d: number;
        percent_change_30d: number;
        percent_change_60d: number;
        percent_change_90d: number;
        market_cap: number;
        market_cap_dominance: number;
        fully_diluted_market_cap: number;
        tvl: number | null;
        last_updated: string;
      };
    };
  };
}

/**
 * Generic HTTP response wrapper
 */
export interface HTTPResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

/**
 * Provider response metadata
 */
export interface ProviderResponseMetadata {
  provider: string;
  timestamp: Date;
  responseTime: number;
  cached: boolean;
  rateLimit?: {
    remaining: number;
    reset: Date;
  };
}

/**
 * Normalized provider response
 */
export interface ProviderResponse<T> {
  success: boolean;
  data?: T;
  error?: Error;
  provider: string;
  timestamp: Date;
  metadata?: ProviderResponseMetadata;
}
