export interface TokenData {
  // Price and market data
  price?: number;
  priceUsd?: number;
  marketCap?: number;
  marketCapUsd?: number;
  volume24h?: number;
  volume24hUsd?: number;

  // Price changes
  priceChange24h?: number;
  priceChangePercentage24h?: number;
  priceChange7d?: number;
  priceChangePercentage7d?: number;
  priceChange30d?: number;
  priceChangePercentage30d?: number;

  // Supply and holders
  totalSupply?: number;
  circulatingSupply?: number;
  maxSupply?: number;
  holders?: number;

  // Token metadata
  name?: string;
  symbol?: string;
  decimals?: number;
  description?: string;
  logo?: string;

  // Trading data
  high24h?: number;
  low24h?: number;
  ath?: number; // All-time high
  atl?: number; // All-time low
  athDate?: Date;
  atlDate?: Date;

  // DEX specific
  liquidity?: number;
  liquidityUsd?: number;

  // Metadata
  lastUpdated?: Date;
  dataSource?: string[];
}

export interface WalletData {
  // Basic balance information
  balance?: { [assetUnit: string]: number };
  balanceUsd?: number;

  // Portfolio data
  portfolio?: PortfolioData;

  // Transaction history
  transactions?: TransactionData[];

  // Staking information
  staking?: StakingData;

  // Metadata
  lastUpdated?: Date;
  dataSource?: string[];
}

export interface PortfolioData {
  // Total portfolio value
  totalValue?: number;
  totalValueUsd?: number;

  // Asset breakdown
  assets?: PortfolioAsset[];

  // NFT holdings
  nfts?: PortfolioNft[];

  // Liquidity pool positions
  liquidityPositions?: LiquidityPosition[];

  // Performance metrics
  performance24h?: number;
  performance7d?: number;
  performance30d?: number;

  // Risk metrics
  diversificationScore?: number;
}

export interface PortfolioAsset {
  assetUnit: string;
  name?: string;
  symbol?: string;
  balance: number;
  value?: number;
  valueUsd?: number;
  percentage?: number;

  // Performance
  change24h?: number;
  changePercentage24h?: number;
}

export interface PortfolioNft {
  policyId: string;
  assetName?: string;
  name?: string;
  collection?: string;
  balance: number;
  floorPrice?: number;
  estimatedValue?: number;

  // Market data
  listings?: number;
  volume24h?: number;
}

export interface LiquidityPosition {
  exchange: string;
  poolId: string;
  tokenA: string;
  tokenB: string;
  tokenAAmount: number;
  tokenBAmount: number;
  sharePercentage?: number;
  value?: number;
  valueUsd?: number;
}

export interface TransactionData {
  hash: string;
  blockHeight?: number;
  timestamp: Date;
  type: TransactionType;
  amount?: number;
  amountUsd?: number;
  fee?: number;
  feeUsd?: number;
  status: TransactionStatus;

  // Addresses involved
  fromAddress?: string;
  toAddress?: string;

  // Assets involved
  assets?: TransactionAsset[];
}

export interface TransactionAsset {
  assetUnit: string;
  amount: number;
  direction: 'in' | 'out';
}

export interface StakingData {
  totalStaked?: number;
  totalStakedUsd?: number;
  rewards?: number;
  rewardsUsd?: number;

  // Staking pools
  pools?: StakingPool[];
}

export interface StakingPool {
  poolId: string;
  poolName?: string;
  stakedAmount: number;
  rewards: number;
  apy?: number;
}

export type TransactionType =
  | 'send'
  | 'receive'
  | 'swap'
  | 'stake'
  | 'unstake'
  | 'reward'
  | 'mint'
  | 'burn'
  | 'contract_interaction';

export type TransactionStatus = 'confirmed' | 'pending' | 'failed';

export interface RequestOptions {
  // Provider preferences
  preferredProviders?: string[];
  fallbackProviders?: string[];

  // Caching options
  useCache?: boolean;
  cacheTimeout?: number;

  // Request timeout
  timeout?: number;

  // Retry options
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * Supported data fields that can be requested
 */
export type TokenDataField = keyof TokenData;
export type WalletDataField = keyof WalletData;

/**
 * Asset unit formats supported by the SDK
 */
export type AssetUnit = string; // policyId + assetNameHex or 'lovelace' for ADA

/**
 * Cardano address formats
 */
export type CardanoAddress = string; // bech32 payment address starting with 'addr'
