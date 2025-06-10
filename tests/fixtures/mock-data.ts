/**
 * Mock data fixtures for testing
 */
import type { PortfolioAsset, TokenData, WalletData } from '../../src/types/common';
import type { ProviderResponse } from '../../src/types/providers';

export const mockTokenData: TokenData = {
  name: 'Cardano',
  symbol: 'ADA',
  decimals: 6,
  description: 'Cardano is a blockchain platform for changemakers, innovators, and visionaries.',
  logo: 'https://assets.coingecko.com/coins/images/975/large/cardano.png',

  price: 0.45,
  priceUsd: 0.45,
  marketCap: 15000000000,
  marketCapUsd: 15000000000,
  volume24h: 500000000,
  volume24hUsd: 500000000,

  priceChange24h: 0.02,
  priceChangePercentage24h: 4.65,
  priceChangePercentage7d: -2.5,
  priceChangePercentage30d: 12.8,

  high24h: 0.47,
  low24h: 0.43,
  ath: 3.1,
  atl: 0.017,
  athDate: new Date('2021-09-02T06:00:10.474Z'),
  atlDate: new Date('2020-03-13T02:22:55.391Z'),

  totalSupply: 45000000000,
  circulatingSupply: 34000000000,
  maxSupply: 45000000000,
  holders: 1500000,

  liquidity: 2000000000,
  liquidityUsd: 900000000,

  lastUpdated: new Date(),
  dataSource: ['coingecko', 'blockfrost'],
};

export const mockWalletData: WalletData = {
  balance: {
    lovelace: 1000000000, // 1000 ADA
    'policy123.asset456': 500000,
  },
  balanceUsd: 450,

  portfolio: {
    totalValue: 450,
    totalValueUsd: 450,
    assets: [
      {
        assetUnit: 'lovelace',
        name: 'Cardano',
        symbol: 'ADA',
        balance: 1000000000,
        value: 450,
        valueUsd: 450,
        percentage: 90,
        change24h: 0.02,
        changePercentage24h: 4.65,
      },
      {
        assetUnit: 'policy123.asset456',
        name: 'Test Token',
        symbol: 'TEST',
        balance: 500000,
        value: 50,
        valueUsd: 50,
        percentage: 10,
        change24h: -0.05,
        changePercentage24h: -1.5,
      },
    ],
    nfts: [
      {
        policyId: 'nft_policy_123',
        assetName: 'cool_nft_001',
        name: 'Cool NFT #1',
        collection: 'Cool NFTs',
        balance: 1,
        floorPrice: 100,
        estimatedValue: 120,
        listings: 5,
        volume24h: 1000,
      },
    ],
    liquidityPositions: [
      {
        exchange: 'minswap',
        poolId: 'pool123',
        tokenA: 'lovelace',
        tokenB: 'policy123.asset456',
        tokenAAmount: 100000000,
        tokenBAmount: 50000,
        sharePercentage: 0.1,
        value: 45,
        valueUsd: 45,
      },
    ],
    performance24h: 2.5,
    performance7d: -1.2,
    performance30d: 8.7,
    diversificationScore: 0.7,
  },

  transactions: [
    {
      hash: 'tx123456789',
      blockHeight: 8234567,
      timestamp: new Date('2023-12-01T10:30:00Z'),
      type: 'receive',
      amount: 100000000,
      amountUsd: 45,
      fee: 200000,
      feeUsd: 0.09,
      status: 'confirmed',
      fromAddress: 'addr1sender',
      toAddress: 'addr1receiver',
      assets: [
        {
          assetUnit: 'lovelace',
          amount: 100000000,
          direction: 'in',
        },
      ],
    },
    {
      hash: 'tx987654321',
      blockHeight: 8234566,
      timestamp: new Date('2023-12-01T09:15:00Z'),
      type: 'send',
      amount: 50000000,
      amountUsd: 22.5,
      fee: 180000,
      feeUsd: 0.08,
      status: 'confirmed',
      fromAddress: 'addr1receiver',
      toAddress: 'addr1other',
      assets: [
        {
          assetUnit: 'lovelace',
          amount: 50000000,
          direction: 'out',
        },
      ],
    },
  ],

  staking: {
    totalStaked: 800000000,
    totalStakedUsd: 360,
    rewards: 5000000,
    rewardsUsd: 2.25,
    pools: [
      {
        poolId: 'pool1abcd1234',
        poolName: 'Test Pool',
        stakedAmount: 800000000,
        rewards: 5000000,
        apy: 4.5,
      },
    ],
  },

  lastUpdated: new Date(),
  dataSource: ['blockfrost', 'taptools'],
};

export const mockProviderResponses = {
  blockfrost: {
    tokenData: {
      success: true,
      data: {
        name: 'Cardano',
        symbol: 'ADA',
        decimals: 6,
        totalSupply: 45000000000,
        circulatingSupply: 34000000000,
        dataSource: ['blockfrost'],
        lastUpdated: new Date(),
      },
      provider: 'blockfrost',
      timestamp: new Date(),
    } as ProviderResponse<Partial<TokenData>>,

    walletData: {
      success: true,
      data: {
        balance: { lovelace: 1000000000 },
        transactions: mockWalletData.transactions,
        dataSource: ['blockfrost'],
        lastUpdated: new Date(),
      },
      provider: 'blockfrost',
      timestamp: new Date(),
    } as ProviderResponse<Partial<WalletData>>,
  },

  coingecko: {
    tokenData: {
      success: true,
      data: {
        name: 'Cardano',
        symbol: 'ADA',
        price: 0.45,
        priceUsd: 0.45,
        marketCap: 15000000000,
        volume24h: 500000000,
        priceChangePercentage24h: 4.65,
        high24h: 0.47,
        low24h: 0.43,
        ath: 3.1,
        atl: 0.017,
        dataSource: ['coingecko'],
        lastUpdated: new Date(),
      },
      provider: 'coingecko',
      timestamp: new Date(),
    } as ProviderResponse<Partial<TokenData>>,

    walletData: {
      success: false,
      error: new Error('CoinGecko does not support wallet data'),
      provider: 'coingecko',
      timestamp: new Date(),
    } as ProviderResponse<Partial<WalletData>>,
  },

  taptools: {
    tokenData: {
      success: true,
      data: {
        holders: 1500000,
        price: 0.46, // Slightly different for conflict testing
        dataSource: ['taptools'],
        lastUpdated: new Date(),
      },
      provider: 'taptools',
      timestamp: new Date(),
    } as ProviderResponse<Partial<TokenData>>,

    walletData: {
      success: true,
      data: {
        portfolio: mockWalletData.portfolio,
        dataSource: ['taptools'],
        lastUpdated: new Date(),
      },
      provider: 'taptools',
      timestamp: new Date(),
    } as ProviderResponse<Partial<WalletData>>,
  },
};

export const mockApiResponses = {
  blockfrost: {
    health: { status: 'ok' },

    asset: {
      asset: 'lovelace',
      policy_id: '',
      asset_name: '',
      fingerprint: '',
      quantity: '45000000000000000',
      initial_mint_tx_hash: '',
      mint_or_burn_count: 0,
      onchain_metadata: {
        name: 'Cardano',
        description: 'Cardano native token',
        ticker: 'ADA',
        decimals: 6,
      },
    },

    address: {
      address: 'addr1test',
      amount: [
        { unit: 'lovelace', quantity: '1000000000' },
        { unit: 'policy123.asset456', quantity: '500000' },
      ],
      type: 'shelley',
      script: false,
    },

    utxos: [
      {
        tx_hash: 'utxo123',
        tx_index: 0,
        output_index: 0,
        amount: [{ unit: 'lovelace', quantity: '500000000' }],
        block: 'block123',
      },
    ],

    transactions: ['tx123456789', 'tx987654321'],

    transaction: {
      hash: 'tx123456789',
      block_height: 8234567,
      block_time: 1701424200,
      output_amount: [{ unit: 'lovelace', quantity: '100000000' }],
      fees: '200000',
      valid_contract: true,
      asset_mint_or_burn_count: 0,
      delegation_count: 0,
      stake_cert_count: 0,
      withdrawal_count: 0,
    },
  },

  coingecko: {
    ping: { gecko_says: '(V3) To the Moon!' },

    coin: {
      id: 'cardano',
      symbol: 'ada',
      name: 'Cardano',
      description: {
        en: 'Cardano is a blockchain platform for changemakers, innovators, and visionaries.',
      },
      image: {
        thumb: 'https://assets.coingecko.com/coins/images/975/thumb/cardano.png',
        small: 'https://assets.coingecko.com/coins/images/975/small/cardano.png',
        large: 'https://assets.coingecko.com/coins/images/975/large/cardano.png',
      },
      market_data: {
        current_price: { usd: 0.45 },
        market_cap: { usd: 15000000000 },
        total_volume: { usd: 500000000 },
        high_24h: { usd: 0.47 },
        low_24h: { usd: 0.43 },
        price_change_24h: 0.02,
        price_change_percentage_24h: 4.65,
        price_change_percentage_7d: -2.5,
        price_change_percentage_30d: 12.8,
        ath: { usd: 3.1 },
        atl: { usd: 0.017 },
        ath_date: { usd: '2021-09-02T06:00:10.474Z' },
        atl_date: { usd: '2020-03-13T02:22:55.391Z' },
        total_supply: 45000000000,
        max_supply: 45000000000,
        circulating_supply: 34000000000,
        last_updated: '2023-12-01T10:30:00.000Z',
      },
    },

    markets: [
      {
        id: 'cardano',
        symbol: 'ada',
        name: 'Cardano',
        image: 'https://assets.coingecko.com/coins/images/975/large/cardano.png',
        current_price: 0.45,
        market_cap: 15000000000,
        total_volume: 500000000,
        high_24h: 0.47,
        low_24h: 0.43,
        price_change_24h: 0.02,
        price_change_percentage_24h: 4.65,
        price_change_percentage_7d_in_currency: -2.5,
        price_change_percentage_30d_in_currency: 12.8,
        ath: 3.1,
        atl: 0.017,
        ath_date: '2021-09-02T06:00:10.474Z',
        atl_date: '2020-03-13T02:22:55.391Z',
        total_supply: 45000000000,
        max_supply: 45000000000,
        circulating_supply: 34000000000,
        last_updated: '2023-12-01T10:30:00.000Z',
      },
    ],

    currencies: ['usd', 'eur', 'btc', 'eth', 'bnb'],
  },
};

export const mockConfigurations = {
  minimal: {
    providers: {
      blockfrost: {
        projectId: 'test_project_id',
      },
    },
  },

  full: {
    providers: {
      blockfrost: {
        projectId: 'test_project_id',
        enabled: true,
      },
      coingecko: {
        apiKey: 'test_api_key',
        pro: false,
        enabled: true,
      },
      taptools: {
        apiKey: 'test_taptools_key',
        enabled: true,
      },
    },
    cache: {
      defaultTtl: 300,
      maxSize: 1000,
      fieldTtl: {
        price: 30,
        marketCap: 60,
        name: 600,
      },
    },
    providerPriorities: {
      price: ['coingecko', 'taptools'],
      name: ['blockfrost'],
      balance: ['blockfrost'],
      portfolio: ['taptools', 'blockfrost'],
    },
    healthCheck: {
      enabled: true,
      interval: 300,
      timeout: 10000,
    },
  },

  performance: {
    providers: {
      blockfrost: { projectId: 'test_project_id' },
      coingecko: { apiKey: 'test_api_key' },
    },
    cache: {
      defaultTtl: 60,
      maxSize: 10000,
    },
    defaultRequestOptions: {
      timeout: 5000,
      maxRetries: 1,
    },
  },
};

export const createMockProvider = (
  name: string,
  capabilities: any,
  responses: any = {},
  shouldFail: boolean = false,
  responseDelay: number = 0,
) => {
  return {
    name,
    version: '1.0.0',
    capabilities,

    async initialize() {
      if (shouldFail) throw new Error(`${name} init failed`);
      return Promise.resolve();
    },

    async destroy() {
      return Promise.resolve();
    },

    async healthCheck() {
      if (shouldFail) throw new Error(`${name} health check failed`);
      return {
        provider: name,
        healthy: true,
        lastCheck: new Date(),
        consecutiveFailures: 0,
        responseTime: responseDelay,
      };
    },

    async getTokenData(assetUnit: string) {
      if (responseDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, responseDelay));
      }

      if (shouldFail) {
        return {
          success: false,
          error: new Error(`${name} token data failed`),
          provider: name,
          timestamp: new Date(),
        };
      }

      return {
        success: true,
        data: responses.tokenData || {},
        provider: name,
        timestamp: new Date(),
      };
    },

    async getWalletData(address: string) {
      if (responseDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, responseDelay));
      }

      if (shouldFail) {
        return {
          success: false,
          error: new Error(`${name} wallet data failed`),
          provider: name,
          timestamp: new Date(),
        };
      }

      return {
        success: true,
        data: responses.walletData || {},
        provider: name,
        timestamp: new Date(),
      };
    },
  };
};
