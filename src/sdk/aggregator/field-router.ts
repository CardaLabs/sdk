/**
 * Field routing system for determining which providers can supply which data fields
 */
import type { DataProvider } from '@/providers/base/provider.interface';
import type { RequestOptions, TokenDataField, WalletDataField } from '@/types/common';
import type { ProviderCapabilities } from '@/types/sdk';

/**
 * Field routing configuration
 */
export interface FieldRoute {
  field: string;
  providers: string[];
  priority: number;
  required: boolean;
}

/**
 * Routing strategy for field requests
 */
export type RoutingStrategy =
  | 'fastest' // Use provider with best response time
  | 'priority' // Use provider based on configured priority
  | 'cost' // Use cheapest provider
  | 'reliability'; // Use most reliable provider

/**
 * Provider performance metrics
 */
export interface ProviderMetrics {
  provider: string;
  avgResponseTime: number;
  successRate: number;
  lastUsed: Date;
  totalRequests: number;
  failedRequests: number;
  cost?: number;
}

/**
 * Field routing plan
 */
export interface RoutingPlan {
  field: string;
  provider: string;
  fallbackProviders: string[];
  estimated: {
    responseTime: number;
    successRate: number;
    cost?: number;
  };
}

/**
 * Aggregation strategy
 */
export interface AggregationStrategy {
  // How to combine data from multiple providers
  combineStrategy: 'first' | 'latest' | 'average' | 'weighted' | 'vote';

  // Conflict resolution when providers return different values
  conflictResolution: 'priority' | 'newest' | 'majority' | 'manual';

  // Weight configuration for weighted strategies
  weights?: Record<string, number>;
}

/**
 * Field router for determining optimal provider for each data field
 */
export class FieldRouter {
  private providers: Map<string, DataProvider> = new Map();
  private metrics: Map<string, ProviderMetrics> = new Map();
  private fieldPriorities: Map<string, string[]> = new Map();
  private defaultStrategy: RoutingStrategy = 'priority';

  constructor(providers: DataProvider[] = [], fieldPriorities: Record<string, string[]> = {}) {
    // Register providers
    for (const provider of providers) {
      this.registerProvider(provider);
    }

    // Set field priorities
    for (const [field, providers] of Object.entries(fieldPriorities)) {
      this.fieldPriorities.set(field, providers);
    }
  }

  /**
   * Register a new provider
   */
  registerProvider(provider: DataProvider): void {
    this.providers.set(provider.name, provider);

    // Initialize metrics
    if (!this.metrics.has(provider.name)) {
      this.metrics.set(provider.name, {
        provider: provider.name,
        avgResponseTime: 1000, // Default 1 second
        successRate: 1.0, // Assume 100% initially
        lastUsed: new Date(),
        totalRequests: 0,
        failedRequests: 0,
      });
    }
  }

  /**
   * Unregister a provider
   */
  unregisterProvider(providerName: string): void {
    this.providers.delete(providerName);
    this.metrics.delete(providerName);
  }

  /**
   * Create routing plan for token data fields
   */
  planTokenDataRouting(
    fields: TokenDataField[],
    options?: RequestOptions,
  ): Map<TokenDataField, RoutingPlan> {
    const plan = new Map<TokenDataField, RoutingPlan>();
    const strategy = this.getRoutingStrategy(options);

    for (const field of fields) {
      const availableProviders = this.getProvidersForTokenField(field);
      const routingPlan = this.createRoutingPlan(field, availableProviders, strategy);

      if (routingPlan) {
        plan.set(field, routingPlan);
      }
    }

    return plan;
  }

  /**
   * Create routing plan for wallet data fields
   */
  planWalletDataRouting(
    fields: WalletDataField[],
    options?: RequestOptions,
  ): Map<WalletDataField, RoutingPlan> {
    const plan = new Map<WalletDataField, RoutingPlan>();
    const strategy = this.getRoutingStrategy(options);

    for (const field of fields) {
      const availableProviders = this.getProvidersForWalletField(field);
      const routingPlan = this.createRoutingPlan(field, availableProviders, strategy);

      if (routingPlan) {
        plan.set(field, routingPlan);
      }
    }

    return plan;
  }

  /**
   * Get providers that can supply a specific token data field
   */
  getProvidersForTokenField(field: TokenDataField): string[] {
    const providers: string[] = [];

    for (const [name, provider] of this.providers.entries()) {
      if (provider.capabilities.tokenData?.includes(field)) {
        providers.push(name);
      }
    }

    return providers;
  }

  /**
   * Get providers that can supply a specific wallet data field
   */
  getProvidersForWalletField(field: WalletDataField): string[] {
    const providers: string[] = [];

    for (const [name, provider] of this.providers.entries()) {
      if (provider.capabilities.walletData?.includes(field)) {
        providers.push(name);
      }
    }

    return providers;
  }

  /**
   * Update provider metrics after a request
   */
  updateMetrics(provider: string, responseTime: number, success: boolean): void {
    const metrics = this.metrics.get(provider);
    if (!metrics) return;

    metrics.totalRequests++;
    metrics.lastUsed = new Date();

    if (success) {
      // Update average response time using exponential moving average
      const alpha = 0.1; // Smoothing factor
      metrics.avgResponseTime = alpha * responseTime + (1 - alpha) * metrics.avgResponseTime;
    } else {
      metrics.failedRequests++;
    }

    // Update success rate
    metrics.successRate = (metrics.totalRequests - metrics.failedRequests) / metrics.totalRequests;
  }

  /**
   * Get provider metrics
   */
  getProviderMetrics(provider: string): ProviderMetrics | undefined {
    return this.metrics.get(provider);
  }

  /**
   * Get all provider metrics
   */
  getAllMetrics(): Map<string, ProviderMetrics> {
    return new Map(this.metrics);
  }

  /**
   * Set field priority order
   */
  setFieldPriority(field: string, providers: string[]): void {
    this.fieldPriorities.set(field, providers);
  }

  /**
   * Get field priority order
   */
  getFieldPriorities(field: string): string[] | undefined {
    return this.fieldPriorities.get(field);
  }

  /**
   * Get optimal provider for a field based on strategy
   */
  getOptimalProvider(
    field: string,
    availableProviders: string[],
    strategy: RoutingStrategy,
  ): string | null {
    if (availableProviders.length === 0) {
      return null;
    }

    if (availableProviders.length === 1) {
      return availableProviders[0] || null;
    }

    switch (strategy) {
      case 'priority':
        return this.getProviderByPriority(field, availableProviders);

      case 'fastest':
        return this.getFastestProvider(availableProviders);

      case 'reliability':
        return this.getMostReliableProvider(availableProviders);

      case 'cost':
        return this.getCheapestProvider(availableProviders);

      default:
        return availableProviders[0] || null;
    }
  }

  private createRoutingPlan(
    field: string,
    availableProviders: string[],
    strategy: RoutingStrategy,
  ): RoutingPlan | null {
    const primaryProvider = this.getOptimalProvider(field, availableProviders, strategy);

    // If no provider available but we have field priorities, use the first priority provider
    // This allows us to generate proper "provider not found" errors
    if (!primaryProvider) {
      const fieldPriorities = this.fieldPriorities.get(field);
      if (fieldPriorities && fieldPriorities.length > 0) {
        const firstPriority = fieldPriorities[0];
        if (firstPriority) {
          return {
            field,
            provider: firstPriority,
            fallbackProviders: fieldPriorities.slice(1),
            estimated: {
              responseTime: 1000,
              successRate: 0,
              cost: 0,
            },
          };
        }
      }
      return null;
    }

    // Create fallback list (remaining providers sorted by preference)
    const fallbackProviders = availableProviders
      .filter((p) => p !== primaryProvider)
      .sort((a, b) => {
        const metricsA = this.metrics.get(a);
        const metricsB = this.metrics.get(b);

        if (!metricsA || !metricsB) return 0;

        // Sort by success rate, then by response time
        if (metricsA.successRate !== metricsB.successRate) {
          return metricsB.successRate - metricsA.successRate;
        }

        return metricsA.avgResponseTime - metricsB.avgResponseTime;
      });

    const metrics = this.metrics.get(primaryProvider);

    return {
      field,
      provider: primaryProvider,
      fallbackProviders,
      estimated: {
        responseTime: metrics?.avgResponseTime ?? 1000,
        successRate: metrics?.successRate ?? 1.0,
        cost: metrics?.cost,
      },
    };
  }

  private getRoutingStrategy(options?: RequestOptions): RoutingStrategy {
    // Could be extended to read from options
    return this.defaultStrategy;
  }

  private getProviderByPriority(field: string, availableProviders: string[]): string {
    const priorities = this.fieldPriorities.get(field);

    if (priorities) {
      for (const provider of priorities) {
        if (availableProviders.includes(provider)) {
          return provider;
        }
      }
    }

    // If no priority set, return first available
    return availableProviders[0] || '';
  }

  private getFastestProvider(availableProviders: string[]): string {
    let fastest = availableProviders[0] || '';
    let fastestTime = this.metrics.get(fastest)?.avgResponseTime ?? Infinity;

    for (const provider of availableProviders) {
      const metrics = this.metrics.get(provider);
      if (metrics && metrics.avgResponseTime < fastestTime) {
        fastest = provider;
        fastestTime = metrics.avgResponseTime;
      }
    }

    return fastest || availableProviders[0] || '';
  }

  private getMostReliableProvider(availableProviders: string[]): string {
    let mostReliable = availableProviders[0] || '';
    let highestRate = this.metrics.get(mostReliable)?.successRate ?? 0;

    for (const provider of availableProviders) {
      const metrics = this.metrics.get(provider);
      if (metrics && metrics.successRate > highestRate) {
        mostReliable = provider;
        highestRate = metrics.successRate;
      }
    }

    return mostReliable || availableProviders[0] || '';
  }

  private getCheapestProvider(availableProviders: string[]): string {
    let cheapest = availableProviders[0] || '';
    let lowestCost = this.metrics.get(cheapest)?.cost ?? 0;

    for (const provider of availableProviders) {
      const metrics = this.metrics.get(provider);
      if (metrics && (metrics.cost ?? 0) < lowestCost) {
        cheapest = provider;
        lowestCost = metrics.cost ?? 0;
      }
    }

    return cheapest || availableProviders[0] || '';
  }
}
