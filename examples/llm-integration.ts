/**
 * LLM Integration Example
 *
 * This example shows how to integrate the Cardalabs SDK with LLM frameworks
 * like OpenAI function calling, Anthropic tool use, and LangChain.
 */
import { CardalabsSDK } from '../src';

// Initialize SDK for LLM use
const sdk = new CardalabsSDK({
  providers: {
    coingecko: { enabled: true },
    blockfrost: {
      projectId: process.env.BLOCKFROST_PROJECT_ID,
      enabled: !!process.env.BLOCKFROST_PROJECT_ID,
    },
  },
});

/**
 * OpenAI Function Calling Integration
 */

// Define function schemas for OpenAI
export const openai_functions = [
  {
    type: 'function' as const,
    function: {
      name: 'get_cardano_token_data',
      description: 'Get real-time market data and information for Cardano tokens',
      parameters: {
        type: 'object',
        properties: {
          asset: {
            type: 'string',
            description:
              "Asset identifier (e.g., 'lovelace' for ADA, or policy_id.asset_name for other tokens)",
          },
          fields: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Data fields to retrieve: price, marketCap, volume24h, priceChangePercentage24h, name, symbol, etc.',
            default: ['price', 'priceChangePercentage24h'],
          },
        },
        required: ['asset'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_cardano_wallet_data',
      description: 'Get wallet balance and portfolio information for a Cardano address',
      parameters: {
        type: 'object',
        properties: {
          address: {
            type: 'string',
            description: 'Cardano wallet address (starts with addr1)',
          },
          fields: {
            type: 'array',
            items: { type: 'string' },
            description: 'Data fields to retrieve: balance, portfolio, transactions, staking',
            default: ['balance'],
          },
        },
        required: ['address'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_cardano_market_overview',
      description: 'Get market overview and statistics for Cardano ecosystem',
      parameters: {
        type: 'object',
        properties: {
          include_stats: {
            type: 'boolean',
            description: 'Include SDK performance statistics',
            default: true,
          },
        },
      },
    },
  },
];

// Function implementations for OpenAI
export async function get_cardano_token_data(
  asset: string,
  fields: string[] = ['price', 'priceChangePercentage24h'],
) {
  try {
    await ensureInitialized();

    const response = await sdk.getTokenData(asset, fields as any);

    return {
      success: true,
      data: response.data,
      metadata: {
        dataSources: response.metadata?.dataSources,
        responseTime: response.metadata?.responseTime,
        cacheStatus: response.metadata?.cacheStatus,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      asset,
    };
  }
}

export async function get_cardano_wallet_data(address: string, fields: string[] = ['balance']) {
  try {
    await ensureInitialized();

    const response = await sdk.getWalletData(address, fields as any);

    return {
      success: true,
      data: response.data,
      metadata: {
        dataSources: response.metadata?.dataSources,
        responseTime: response.metadata?.responseTime,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      address,
    };
  }
}

export async function get_cardano_market_overview(include_stats: boolean = true) {
  try {
    await ensureInitialized();

    // Get ADA market data
    const adaData = await sdk.getTokenData('lovelace', [
      'price',
      'marketCap',
      'volume24h',
      'priceChangePercentage24h',
    ]);

    // Get provider health
    const health = await sdk.getProviderHealth();

    const overview = {
      ada: {
        price: adaData.data.price,
        marketCap: adaData.data.marketCap,
        volume24h: adaData.data.volume24h,
        change24h: adaData.data.priceChangePercentage24h,
      },
      providers: Object.fromEntries(
        Object.entries(health).map(([name, status]) => [
          name,
          { healthy: status.healthy, responseTime: status.responseTime },
        ]),
      ),
    };

    if (include_stats) {
      const stats = await sdk.getStats();
      (overview as any).stats = {
        totalRequests: stats.requests.total,
        cacheHitRate: stats.cache.hitRate,
        uptime: stats.uptime,
      };
    }

    return {
      success: true,
      data: overview,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Anthropic Claude Tool Use Integration
 */

export const anthropic_tools = [
  {
    name: 'get_cardano_data',
    description:
      'Get real-time Cardano blockchain and market data including token prices, wallet balances, and market statistics',
    input_schema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['token_data', 'wallet_data', 'market_overview'],
          description: 'The type of data to retrieve',
        },
        asset_or_address: {
          type: 'string',
          description:
            "Asset ID for token data (e.g., 'lovelace') or wallet address for wallet data",
        },
        fields: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific data fields to retrieve (optional)',
        },
      },
      required: ['action'],
    },
  },
];

// Unified function for Anthropic
export async function get_cardano_data(params: {
  action: 'token_data' | 'wallet_data' | 'market_overview';
  asset_or_address?: string;
  fields?: string[];
}) {
  const { action, asset_or_address, fields } = params;

  switch (action) {
    case 'token_data':
      if (!asset_or_address) {
        return { error: 'asset_or_address required for token_data' };
      }
      return await get_cardano_token_data(asset_or_address, fields);

    case 'wallet_data':
      if (!asset_or_address) {
        return { error: 'asset_or_address required for wallet_data' };
      }
      return await get_cardano_wallet_data(asset_or_address, fields);

    case 'market_overview':
      return await get_cardano_market_overview(true);

    default:
      return { error: `Unknown action: ${action}` };
  }
}

/**
 * LangChain Integration
 */

// LangChain-style tool definition
export class CardanoDataTool {
  name = 'cardano_data';
  description = 'Get Cardano blockchain and market data';

  async _call(input: string): Promise<string> {
    try {
      // Parse input (could be JSON or natural language)
      let params;
      try {
        params = JSON.parse(input);
      } catch {
        // Handle natural language input
        if (input.toLowerCase().includes('ada') || input.toLowerCase().includes('lovelace')) {
          params = { action: 'token_data', asset_or_address: 'lovelace' };
        } else if (input.toLowerCase().includes('wallet') || input.startsWith('addr1')) {
          params = { action: 'wallet_data', asset_or_address: input.trim() };
        } else {
          params = { action: 'market_overview' };
        }
      }

      const result = await get_cardano_data(params);
      return JSON.stringify(result, null, 2);
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

/**
 * Custom LLM Assistant Functions
 */

export class CardanoAssistant {
  private initialized = false;

  async initialize() {
    if (!this.initialized) {
      await sdk.initialize();
      this.initialized = true;
    }
  }

  async analyzeToken(asset: string) {
    await this.initialize();

    const data = await sdk.getTokenData(asset, [
      'price',
      'marketCap',
      'volume24h',
      'priceChangePercentage24h',
      'name',
      'symbol',
      'totalSupply',
      'holders',
    ]);

    // Generate analysis
    const price = data.data.price || 0;
    const change = data.data.priceChangePercentage24h || 0;
    const volume = data.data.volume24h || 0;
    const marketCap = data.data.marketCap || 0;

    return {
      token: {
        name: data.data.name,
        symbol: data.data.symbol,
        price: price,
        marketCap: marketCap,
      },
      analysis: {
        priceDirection: change >= 0 ? 'up' : 'down',
        volatility: Math.abs(change) > 5 ? 'high' : 'moderate',
        liquidity: volume > marketCap * 0.1 ? 'high' : 'low',
        sentiment: change > 2 ? 'bullish' : change < -2 ? 'bearish' : 'neutral',
      },
      metrics: {
        change24h: change,
        volume24h: volume,
        volumeToMarketCapRatio: marketCap > 0 ? volume / marketCap : 0,
      },
    };
  }

  async compareTokens(assets: string[]) {
    await this.initialize();

    const comparisons = await Promise.all(
      assets.map(async (asset) => {
        try {
          const data = await sdk.getTokenData(asset, [
            'price',
            'priceChangePercentage24h',
            'marketCap',
          ]);
          return {
            asset,
            price: data.data.price,
            change24h: data.data.priceChangePercentage24h,
            marketCap: data.data.marketCap,
          };
        } catch {
          return { asset, error: 'Data not available' };
        }
      }),
    );

    return {
      comparison: comparisons,
      bestPerformer: comparisons
        .filter((c) => !c.error && c.change24h)
        .sort((a, b) => (b.change24h || 0) - (a.change24h || 0))[0],
      worstPerformer: comparisons
        .filter((c) => !c.error && c.change24h)
        .sort((a, b) => (a.change24h || 0) - (b.change24h || 0))[0],
    };
  }

  async getMarketSentiment() {
    await this.initialize();

    const ada = await sdk.getTokenData('lovelace', [
      'price',
      'priceChangePercentage24h',
      'volume24h',
      'marketCap',
    ]);

    const change = ada.data.priceChangePercentage24h || 0;

    let sentiment = 'neutral';
    if (change > 5) sentiment = 'very bullish';
    else if (change > 2) sentiment = 'bullish';
    else if (change < -5) sentiment = 'very bearish';
    else if (change < -2) sentiment = 'bearish';

    return {
      sentiment,
      adaPrice: ada.data.price,
      change24h: change,
      confidence: Math.min(Math.abs(change) / 10, 1), // 0-1 confidence based on magnitude
    };
  }

  async destroy() {
    if (this.initialized) {
      await sdk.destroy();
      this.initialized = false;
    }
  }
}

// Utility function to ensure SDK is initialized
async function ensureInitialized() {
  if (!(sdk as any).initialized) {
    await sdk.initialize();
  }
}

// Example usage for different LLM frameworks
async function demonstrateLLMIntegration() {
  console.log('🤖 Cardalabs SDK - LLM Integration Example\n');

  try {
    // Example 1: OpenAI Function Calling
    console.log('1️⃣ OpenAI Function Calling Example:');
    const tokenResult = await get_cardano_token_data('lovelace', [
      'price',
      'priceChangePercentage24h',
    ]);
    console.log('   ADA Data:', JSON.stringify(tokenResult, null, 2));

    // Example 2: Anthropic Tool Use
    console.log('\n2️⃣ Anthropic Tool Use Example:');
    const marketResult = await get_cardano_data({ action: 'market_overview' });
    console.log('   Market Overview:', JSON.stringify(marketResult, null, 2));

    // Example 3: Custom Assistant
    console.log('\n3️⃣ Custom Assistant Example:');
    const assistant = new CardanoAssistant();
    await assistant.initialize();

    const analysis = await assistant.analyzeToken('lovelace');
    console.log('   Token Analysis:', JSON.stringify(analysis, null, 2));

    const sentiment = await assistant.getMarketSentiment();
    console.log('   Market Sentiment:', JSON.stringify(sentiment, null, 2));

    await assistant.destroy();
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the example
if (require.main === module) {
  demonstrateLLMIntegration().catch(console.error);
}

export { openai_functions, anthropic_tools, CardanoAssistant, CardanoDataTool };
