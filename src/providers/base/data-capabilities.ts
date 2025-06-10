/**
 * Data capabilities and field mapping system for providers
 */
import type { TokenDataField, WalletDataField } from '@/types/common';

/**
 * Field mapping configuration for a provider
 */
export interface FieldMapping {
  // Fields this provider can supply for token data
  tokenData: TokenDataField[];

  // Fields this provider can supply for wallet data
  walletData: WalletDataField[];

  // Field-specific configuration
  fieldConfig: Record<string, FieldConfig>;
}

/**
 * Configuration for a specific field
 */
export interface FieldConfig {
  // How reliable this provider is for this field (0-1)
  reliability: number;

  // How fresh the data typically is (in seconds)
  freshness: number;

  // Cost/complexity of getting this field
  cost: 'low' | 'medium' | 'high';

  // Whether this field requires authentication
  requiresAuth: boolean;

  // Rate limit impact for this field
  rateLimitImpact: number;

  // Dependencies on other fields
  dependencies?: string[];
}

/**
 * Standard field mappings for common providers
 */
export const STANDARD_FIELD_MAPPINGS: Record<string, FieldMapping> = {
  blockfrost: {
    tokenData: ['name', 'symbol', 'decimals', 'totalSupply', 'description', 'logo'],
    walletData: ['balance', 'transactions', 'staking'],
    fieldConfig: {
      name: {
        reliability: 0.95,
        freshness: 600,
        cost: 'low',
        requiresAuth: true,
        rateLimitImpact: 1,
      },
      symbol: {
        reliability: 0.95,
        freshness: 600,
        cost: 'low',
        requiresAuth: true,
        rateLimitImpact: 1,
      },
      decimals: {
        reliability: 0.99,
        freshness: 3600,
        cost: 'low',
        requiresAuth: true,
        rateLimitImpact: 1,
      },
      totalSupply: {
        reliability: 0.9,
        freshness: 300,
        cost: 'medium',
        requiresAuth: true,
        rateLimitImpact: 2,
      },
      balance: {
        reliability: 0.99,
        freshness: 30,
        cost: 'medium',
        requiresAuth: true,
        rateLimitImpact: 2,
      },
      transactions: {
        reliability: 0.95,
        freshness: 60,
        cost: 'high',
        requiresAuth: true,
        rateLimitImpact: 5,
      },
    },
  },

  coingecko: {
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
    ],
    walletData: [],
    fieldConfig: {
      price: {
        reliability: 0.98,
        freshness: 30,
        cost: 'low',
        requiresAuth: false,
        rateLimitImpact: 1,
      },
      priceUsd: {
        reliability: 0.98,
        freshness: 30,
        cost: 'low',
        requiresAuth: false,
        rateLimitImpact: 1,
      },
      marketCap: {
        reliability: 0.95,
        freshness: 60,
        cost: 'low',
        requiresAuth: false,
        rateLimitImpact: 1,
      },
      volume24h: {
        reliability: 0.9,
        freshness: 300,
        cost: 'low',
        requiresAuth: false,
        rateLimitImpact: 1,
      },
      priceChange24h: {
        reliability: 0.95,
        freshness: 60,
        cost: 'low',
        requiresAuth: false,
        rateLimitImpact: 1,
      },
    },
  },

  taptools: {
    tokenData: [
      'price',
      'marketCap',
      'volume24h',
      'holders',
      'totalSupply',
      'circulatingSupply',
      'liquidity',
      'liquidityUsd',
    ],
    walletData: ['balance', 'balanceUsd', 'portfolio'],
    fieldConfig: {
      price: {
        reliability: 0.92,
        freshness: 60,
        cost: 'low',
        requiresAuth: true,
        rateLimitImpact: 1,
      },
      holders: {
        reliability: 0.85,
        freshness: 900,
        cost: 'medium',
        requiresAuth: true,
        rateLimitImpact: 2,
      },
      portfolio: {
        reliability: 0.9,
        freshness: 300,
        cost: 'high',
        requiresAuth: true,
        rateLimitImpact: 5,
      },
      liquidity: {
        reliability: 0.85,
        freshness: 300,
        cost: 'medium',
        requiresAuth: true,
        rateLimitImpact: 2,
      },
    },
  },

  dexscreener: {
    tokenData: [
      'price',
      'priceUsd',
      'volume24h',
      'volume24hUsd',
      'priceChange24h',
      'priceChangePercentage24h',
      'liquidity',
      'liquidityUsd',
      'marketCap',
    ],
    walletData: [],
    fieldConfig: {
      price: {
        reliability: 0.85,
        freshness: 120,
        cost: 'low',
        requiresAuth: false,
        rateLimitImpact: 1,
      },
      liquidity: {
        reliability: 0.9,
        freshness: 180,
        cost: 'low',
        requiresAuth: false,
        rateLimitImpact: 1,
      },
      volume24h: {
        reliability: 0.88,
        freshness: 300,
        cost: 'low',
        requiresAuth: false,
        rateLimitImpact: 1,
      },
    },
  },
};

/**
 * Capability matcher for finding providers that can supply specific fields
 */
export class CapabilityMatcher {
  private fieldMappings: Map<string, FieldMapping> = new Map();

  constructor(mappings: Record<string, FieldMapping> = STANDARD_FIELD_MAPPINGS) {
    Object.entries(mappings).forEach(([provider, mapping]) => {
      this.fieldMappings.set(provider, mapping);
    });
  }

  /**
   * Register a new provider's field mapping
   */
  registerProvider(name: string, mapping: FieldMapping): void {
    this.fieldMappings.set(name, mapping);
  }

  /**
   * Find providers that can supply a specific token data field
   */
  getProvidersForTokenField(field: TokenDataField): string[] {
    const providers: string[] = [];

    for (const [providerName, mapping] of this.fieldMappings) {
      if (mapping.tokenData.includes(field)) {
        providers.push(providerName);
      }
    }

    return providers;
  }

  /**
   * Find providers that can supply a specific wallet data field
   */
  getProvidersForWalletField(field: WalletDataField): string[] {
    const providers: string[] = [];

    for (const [providerName, mapping] of this.fieldMappings) {
      if (mapping.walletData.includes(field)) {
        providers.push(providerName);
      }
    }

    return providers;
  }

  /**
   * Get optimal provider for a field based on reliability and cost
   */
  getOptimalProviderForField(
    field: TokenDataField | WalletDataField,
    dataType: 'token' | 'wallet',
    preferences: {
      preferReliability?: boolean;
      preferSpeed?: boolean;
      preferCost?: boolean;
    } = {},
  ): string | null {
    const providers =
      dataType === 'token'
        ? this.getProvidersForTokenField(field as TokenDataField)
        : this.getProvidersForWalletField(field as WalletDataField);

    if (providers.length === 0) {
      return null;
    }

    // Score providers based on preferences
    const scoredProviders = providers.map((provider) => {
      const mapping = this.fieldMappings.get(provider);
      const config = mapping?.fieldConfig[field];

      if (!config) {
        return { provider, score: 0 };
      }

      let score = 0;

      // Reliability score (0-100)
      score += config.reliability * 100;

      // Speed score (inverse of freshness, max 50)
      score += Math.max(0, 50 - config.freshness / 60);

      // Cost score (lower cost = higher score, max 30)
      const costScore = config.cost === 'low' ? 30 : config.cost === 'medium' ? 15 : 5;
      score += costScore;

      // Apply preferences
      if (preferences.preferReliability) {
        score += config.reliability * 50;
      }
      if (preferences.preferSpeed) {
        score += Math.max(0, 30 - config.freshness / 120);
      }
      if (preferences.preferCost) {
        score += costScore;
      }

      return { provider, score };
    });

    // Return provider with highest score
    scoredProviders.sort((a, b) => b.score - a.score);
    return scoredProviders[0]?.provider ?? null;
  }

  /**
   * Get field configuration for a provider
   */
  getFieldConfig(provider: string, field: string): FieldConfig | undefined {
    const mapping = this.fieldMappings.get(provider);
    return mapping?.fieldConfig[field];
  }

  /**
   * Check if a provider can supply all requested fields
   */
  canProvideAllFields(
    provider: string,
    tokenFields: TokenDataField[] = [],
    walletFields: WalletDataField[] = [],
  ): boolean {
    const mapping = this.fieldMappings.get(provider);
    if (!mapping) {
      return false;
    }

    const canProvideTokenFields = tokenFields.every((field) => mapping.tokenData.includes(field));

    const canProvideWalletFields = walletFields.every((field) =>
      mapping.walletData.includes(field),
    );

    return canProvideTokenFields && canProvideWalletFields;
  }

  /**
   * Get provider coverage for a set of fields
   */
  getProviderCoverage(
    tokenFields: TokenDataField[] = [],
    walletFields: WalletDataField[] = [],
  ): Record<string, { tokenCoverage: number; walletCoverage: number; totalCoverage: number }> {
    const coverage: Record<
      string,
      { tokenCoverage: number; walletCoverage: number; totalCoverage: number }
    > = {};

    for (const [providerName, mapping] of this.fieldMappings) {
      const tokenCoverage =
        tokenFields.length > 0
          ? tokenFields.filter((field) => mapping.tokenData.includes(field)).length /
            tokenFields.length
          : 1;

      const walletCoverage =
        walletFields.length > 0
          ? walletFields.filter((field) => mapping.walletData.includes(field)).length /
            walletFields.length
          : 1;

      const totalFields = tokenFields.length + walletFields.length;
      const coveredFields =
        tokenFields.filter((field) => mapping.tokenData.includes(field)).length +
        walletFields.filter((field) => mapping.walletData.includes(field)).length;

      const totalCoverage = totalFields > 0 ? coveredFields / totalFields : 1;

      coverage[providerName] = {
        tokenCoverage,
        walletCoverage,
        totalCoverage,
      };
    }

    return coverage;
  }
}
