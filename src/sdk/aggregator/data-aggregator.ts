/**
 * Data aggregation engine for combining responses from multiple providers
 */
import type { DataProvider } from '@/providers/base/provider.interface';
import type {
  AssetUnit,
  CardanoAddress,
  RequestOptions,
  TokenData,
  WalletData,
} from '@/types/common';
import type { ResponseMetadata, SDKResponse } from '@/types/sdk';

import { type AggregationStrategy, FieldRouter, type RoutingPlan } from './field-router';

/**
 * Aggregation request for token data
 */
export interface TokenDataAggregationRequest {
  assetUnit: AssetUnit;
  fields: (keyof TokenData)[];
  options?: RequestOptions;
  strategy?: AggregationStrategy;
}

/**
 * Aggregation request for wallet data
 */
export interface WalletDataAggregationRequest {
  address: CardanoAddress;
  fields: (keyof WalletData)[];
  options?: RequestOptions;
  strategy?: AggregationStrategy;
}

/**
 * Provider execution result
 */
interface ProviderExecution {
  provider: string;
  success: boolean;
  data?: any;
  error?: Error;
  responseTime: number;
  fieldsProvided: string[];
}

/**
 * Field aggregation result
 */
interface FieldAggregationResult {
  field: string;
  value: any;
  sources: string[];
  confidence: number;
  conflicts?: Array<{
    provider: string;
    value: any;
  }>;
}

/**
 * Data aggregator for combining multiple provider responses
 */
export class DataAggregator {
  private fieldRouter: FieldRouter;
  private providers: Map<string, DataProvider> = new Map();
  private defaultStrategy: AggregationStrategy = {
    combineStrategy: 'first',
    conflictResolution: 'priority',
  };

  constructor(providers: DataProvider[] = [], fieldPriorities: Record<string, string[]> = {}) {
    this.fieldRouter = new FieldRouter(providers, fieldPriorities);

    for (const provider of providers) {
      this.providers.set(provider.name, provider);
    }
  }

  /**
   * Aggregate token data from multiple providers
   */
  async aggregateTokenData(request: TokenDataAggregationRequest): Promise<SDKResponse<TokenData>> {
    const startTime = Date.now();
    const strategy = request.strategy ?? this.defaultStrategy;

    try {
      // Create routing plan
      const routingPlan = this.fieldRouter.planTokenDataRouting(request.fields, request.options);

      const missingProviderExecutions: ProviderExecution[] = [];
      for (const field of request.fields) {
        if (!routingPlan.has(field)) {
          // Field couldn't be routed - provider not found
          const fieldPriorities = this.fieldRouter.getFieldPriorities(field);
          const missingProvider = fieldPriorities?.[0] || 'unknown';

          missingProviderExecutions.push({
            provider: missingProvider,
            success: false,
            error: new Error(`Provider ${missingProvider} not found`),
            responseTime: 1,
            fieldsProvided: [],
          });
        }
      }

      // Execute requests
      const executions = await this.executeTokenDataRequests(
        request.assetUnit,
        routingPlan,
        request.options,
      );

      const allExecutions = [...executions, ...missingProviderExecutions];

      // Aggregate results
      const aggregationResults = this.aggregateFieldResults(
        request.fields,
        allExecutions,
        strategy,
      );

      // Build final token data
      const tokenData = this.buildTokenData(aggregationResults);

      // Build metadata
      const metadata = this.buildResponseMetadata(allExecutions, startTime, routingPlan);

      return {
        data: tokenData,
        metadata,
        errors: this.extractErrors(allExecutions),
      };
    } catch (error) {
      return {
        data: {} as TokenData,
        metadata: {
          dataSources: [],
          cacheStatus: 'miss',
          responseTime: Date.now() - startTime,
          timestamp: new Date(),
        },
        errors: [
          {
            provider: 'aggregator',
            error: (error as Error).message,
            recoverable: false,
          },
        ],
      };
    }
  }

  /**
   * Aggregate wallet data from multiple providers
   */
  async aggregateWalletData(
    request: WalletDataAggregationRequest,
  ): Promise<SDKResponse<WalletData>> {
    const startTime = Date.now();
    const strategy = request.strategy ?? this.defaultStrategy;

    try {
      // Create routing plan
      const routingPlan = this.fieldRouter.planWalletDataRouting(request.fields, request.options);

      // Execute requests
      const executions = await this.executeWalletDataRequests(
        request.address,
        routingPlan,
        request.options,
      );

      // Aggregate results
      const aggregationResults = this.aggregateFieldResults(request.fields, executions, strategy);

      // Build final wallet data
      const walletData = this.buildWalletData(aggregationResults);

      // Build metadata
      const metadata = this.buildResponseMetadata(executions, startTime, routingPlan);

      return {
        data: walletData,
        metadata,
        errors: this.extractErrors(executions),
      };
    } catch (error) {
      return {
        data: {} as WalletData,
        metadata: {
          dataSources: [],
          cacheStatus: 'miss',
          responseTime: Date.now() - startTime,
          timestamp: new Date(),
        },
        errors: [
          {
            provider: 'aggregator',
            error: (error as Error).message,
            recoverable: false,
          },
        ],
      };
    }
  }

  /**
   * Register a new provider
   */
  registerProvider(provider: DataProvider): void {
    this.providers.set(provider.name, provider);
    this.fieldRouter.registerProvider(provider);
  }

  /**
   * Update field priority configuration
   */
  setFieldPriority(field: string, providers: string[]): void {
    this.fieldRouter.setFieldPriority(field, providers);
  }

  private async executeTokenDataRequests(
    assetUnit: AssetUnit,
    routingPlan: Map<string, RoutingPlan>,
    options?: RequestOptions,
  ): Promise<ProviderExecution[]> {
    const providerRequests = new Map<string, string[]>();

    // Group fields by provider
    for (const [field, plan] of routingPlan.entries()) {
      if (!providerRequests.has(plan.provider)) {
        providerRequests.set(plan.provider, []);
      }
      providerRequests.get(plan.provider)!.push(field);
    }

    // For fields with multiple priority providers, add them all
    for (const [field, plan] of routingPlan.entries()) {
      const fieldPriorities = this.fieldRouter.getFieldPriorities(field);
      if (fieldPriorities && fieldPriorities.length > 1) {
        for (const providerName of fieldPriorities) {
          if (providerName !== plan.provider && this.providers.has(providerName)) {
            const provider = this.providers.get(providerName);
            if (provider?.capabilities.tokenData?.includes(field as any)) {
              if (!providerRequests.has(providerName)) {
                providerRequests.set(providerName, []);
              }
              if (!providerRequests.get(providerName)!.includes(field)) {
                providerRequests.get(providerName)!.push(field);
              }
            }
          }
        }
      }
    }

    // Execute requests in parallel with timeout support
    const promises = Array.from(providerRequests.entries()).map(
      async ([providerName, fields]): Promise<ProviderExecution> => {
        const provider = this.providers.get(providerName);
        const startTime = Date.now();

        if (!provider) {
          return {
            provider: providerName,
            success: false,
            error: new Error(`Provider ${providerName} not found`),
            responseTime: Date.now() - startTime,
            fieldsProvided: [],
          };
        }

        try {
          // Apply timeout if specified
          const timeout = options?.timeout || 30000; // Default 30s timeout
          const responsePromise = provider.getTokenData(assetUnit, options);

          const response = await Promise.race([
            responsePromise,
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error(`Request timeout after ${timeout}ms`)), timeout),
            ),
          ]);

          const responseTime = Date.now() - startTime;

          // Update metrics
          this.fieldRouter.updateMetrics(providerName, responseTime, response.success);

          if (response.success) {
            return {
              provider: providerName,
              success: true,
              data: response.data,
              responseTime,
              fieldsProvided: fields,
            };
          } else {
            return {
              provider: providerName,
              success: false,
              error: response.error,
              responseTime,
              fieldsProvided: [],
            };
          }
        } catch (error) {
          const responseTime = Date.now() - startTime;

          // Update metrics
          this.fieldRouter.updateMetrics(providerName, responseTime, false);

          return {
            provider: providerName,
            success: false,
            error: error as Error,
            responseTime,
            fieldsProvided: [],
          };
        }
      },
    );

    const executions = await Promise.all(promises);

    // Handle fallbacks for failed providers
    const fallbackExecutions: ProviderExecution[] = [];

    for (const [field, plan] of routingPlan.entries()) {
      const primaryExecution = executions.find((e) => e.provider === plan.provider);

      // If primary provider failed and we have fallbacks, try them
      if (primaryExecution && !primaryExecution.success && plan.fallbackProviders.length > 0) {
        for (const fallbackProvider of plan.fallbackProviders) {
          const provider = this.providers.get(fallbackProvider);
          if (!provider) continue;

          // Skip if we already executed this provider successfully
          if (executions.some((e) => e.provider === fallbackProvider && e.success)) {
            continue;
          }

          try {
            const startTime = Date.now();
            const timeout = options?.timeout || 30000;
            const responsePromise = provider.getTokenData(assetUnit, options);

            const response = await Promise.race([
              responsePromise,
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error(`Request timeout after ${timeout}ms`)), timeout),
              ),
            ]);

            const responseTime = Date.now() - startTime;

            this.fieldRouter.updateMetrics(fallbackProvider, responseTime, response.success);

            if (response.success) {
              fallbackExecutions.push({
                provider: fallbackProvider,
                success: true,
                data: response.data,
                responseTime,
                fieldsProvided: [field],
              });
              break; // Successfully got data, no need to try more fallbacks
            }
          } catch (error) {
            // Continue to next fallback provider
            continue;
          }
        }
      }
    }

    return [...executions, ...fallbackExecutions];
  }

  private async executeWalletDataRequests(
    address: CardanoAddress,
    routingPlan: Map<string, RoutingPlan>,
    options?: RequestOptions,
  ): Promise<ProviderExecution[]> {
    const providerRequests = new Map<string, string[]>();

    // Group fields by provider
    for (const [field, plan] of routingPlan.entries()) {
      if (!providerRequests.has(plan.provider)) {
        providerRequests.set(plan.provider, []);
      }
      providerRequests.get(plan.provider)!.push(field);
    }

    // Execute requests in parallel with timeout support
    const promises = Array.from(providerRequests.entries()).map(
      async ([providerName, fields]): Promise<ProviderExecution> => {
        const provider = this.providers.get(providerName);
        const startTime = Date.now();

        if (!provider) {
          return {
            provider: providerName,
            success: false,
            error: new Error(`Provider ${providerName} not found`),
            responseTime: Date.now() - startTime,
            fieldsProvided: [],
          };
        }

        try {
          // Apply timeout if specified
          const timeout = options?.timeout || 30000; // Default 30s timeout
          const responsePromise = provider.getWalletData(address, options);

          const response = await Promise.race([
            responsePromise,
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error(`Request timeout after ${timeout}ms`)), timeout),
            ),
          ]);

          const responseTime = Date.now() - startTime;

          // Update metrics
          this.fieldRouter.updateMetrics(providerName, responseTime, response.success);

          if (response.success) {
            return {
              provider: providerName,
              success: true,
              data: response.data,
              responseTime,
              fieldsProvided: fields,
            };
          } else {
            return {
              provider: providerName,
              success: false,
              error: response.error,
              responseTime,
              fieldsProvided: [],
            };
          }
        } catch (error) {
          const responseTime = Date.now() - startTime;

          // Update metrics
          this.fieldRouter.updateMetrics(providerName, responseTime, false);

          return {
            provider: providerName,
            success: false,
            error: error as Error,
            responseTime,
            fieldsProvided: [],
          };
        }
      },
    );

    const executions = await Promise.all(promises);

    // Handle fallbacks for failed providers
    const fallbackExecutions: ProviderExecution[] = [];

    for (const [field, plan] of routingPlan.entries()) {
      const primaryExecution = executions.find((e) => e.provider === plan.provider);

      // If primary provider failed and we have fallbacks, try them
      if (primaryExecution && !primaryExecution.success && plan.fallbackProviders.length > 0) {
        for (const fallbackProvider of plan.fallbackProviders) {
          const provider = this.providers.get(fallbackProvider);
          if (!provider) continue;

          // Skip if we already executed this provider successfully
          if (executions.some((e) => e.provider === fallbackProvider && e.success)) {
            continue;
          }

          try {
            const startTime = Date.now();
            const timeout = options?.timeout || 30000;
            const responsePromise = provider.getWalletData(address, options);

            const response = await Promise.race([
              responsePromise,
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error(`Request timeout after ${timeout}ms`)), timeout),
              ),
            ]);

            const responseTime = Date.now() - startTime;

            this.fieldRouter.updateMetrics(fallbackProvider, responseTime, response.success);

            if (response.success) {
              fallbackExecutions.push({
                provider: fallbackProvider,
                success: true,
                data: response.data,
                responseTime,
                fieldsProvided: [field],
              });
              break; // Successfully got data, no need to try more fallbacks
            }
          } catch (error) {
            // Continue to next fallback provider
            continue;
          }
        }
      }
    }

    return [...executions, ...fallbackExecutions];
  }

  private aggregateFieldResults(
    requestedFields: string[],
    executions: ProviderExecution[],
    strategy: AggregationStrategy,
  ): Map<string, FieldAggregationResult> {
    const results = new Map<string, FieldAggregationResult>();

    for (const field of requestedFields) {
      const fieldResults = this.aggregateField(field, executions, strategy);
      if (fieldResults) {
        results.set(field, fieldResults);
      }
    }

    return results;
  }

  private aggregateField(
    field: string,
    executions: ProviderExecution[],
    strategy: AggregationStrategy,
  ): FieldAggregationResult | null {
    // Get all successful executions that have this field
    const validExecutions = executions.filter(
      (exec) => exec.success && exec.data && exec.data[field] !== undefined,
    );

    if (validExecutions.length === 0) {
      return null;
    }

    // Extract values from each provider
    const values = validExecutions.map((exec) => ({
      provider: exec.provider,
      value: exec.data[field],
    }));

    // Handle single value case
    if (values.length === 1) {
      return {
        field,
        value: values[0]?.value,
        sources: [values[0]?.provider || 'unknown'],
        confidence: 1.0,
      };
    }

    // Handle multiple values based on strategy
    return this.resolveFieldConflicts(field, values, strategy);
  }

  private resolveFieldConflicts(
    field: string,
    values: Array<{ provider: string; value: any }>,
    strategy: AggregationStrategy,
  ): FieldAggregationResult {
    const uniqueValues = this.getUniqueValues(values);

    // No conflicts - all providers agree
    if (uniqueValues.length === 1) {
      return {
        field,
        value: uniqueValues[0]?.value,
        sources: values.map((v) => v?.provider || 'unknown'),
        confidence: 1.0,
      };
    }

    // Handle conflicts based on resolution strategy
    switch (strategy.conflictResolution) {
      case 'priority':
        return this.resolveBypriority(field, values, uniqueValues);

      case 'newest':
        return this.resolveByNewest(field, values, uniqueValues);

      case 'majority':
        return this.resolveByMajority(field, values, uniqueValues);

      default:
        return this.resolveBypriority(field, values, uniqueValues);
    }
  }

  private getUniqueValues(values: Array<{ provider: string; value: any }>) {
    const unique = new Map<string, { provider: string; value: any; count: number }>();

    for (const item of values) {
      const key = JSON.stringify(item.value);
      if (unique.has(key)) {
        unique.get(key)!.count++;
      } else {
        unique.set(key, { ...item, count: 1 });
      }
    }

    return Array.from(unique.values());
  }

  private resolveBypriority(
    field: string,
    values: Array<{ provider: string; value: any }>,
    uniqueValues: Array<{ provider: string; value: any; count: number }>,
  ): FieldAggregationResult {
    // Use first value (assumes values are already ordered by priority)
    const chosen = values[0];

    if (!chosen) {
      throw new Error(`No values available for field: ${field}`);
    }

    return {
      field,
      value: chosen.value,
      sources: [chosen.provider],
      confidence: 0.8, // Lower confidence due to conflicts
      conflicts: uniqueValues.filter((v) => v.value !== chosen.value),
    };
  }

  private resolveByNewest(
    field: string,
    values: Array<{ provider: string; value: any }>,
    uniqueValues: Array<{ provider: string; value: any; count: number }>,
  ): FieldAggregationResult {
    // For now, just use priority-based resolution
    // Would need timestamp metadata to implement properly
    return this.resolveBypriority(field, values, uniqueValues);
  }

  private resolveByMajority(
    field: string,
    values: Array<{ provider: string; value: any }>,
    uniqueValues: Array<{ provider: string; value: any; count: number }>,
  ): FieldAggregationResult {
    // Find value with highest count
    const majority = uniqueValues.reduce((max, current) =>
      current.count > max.count ? current : max,
    );

    const sources = values
      .filter((v) => JSON.stringify(v.value) === JSON.stringify(majority.value))
      .map((v) => v.provider);

    return {
      field,
      value: majority.value,
      sources,
      confidence: majority.count / values.length,
      conflicts: uniqueValues.filter((v) => v.value !== majority.value),
    };
  }

  private buildTokenData(aggregationResults: Map<string, FieldAggregationResult>): TokenData {
    const tokenData: Partial<TokenData> = {};
    const dataSources: string[] = [];

    for (const [field, result] of aggregationResults.entries()) {
      (tokenData as any)[field] = result.value;
      dataSources.push(...result.sources);
    }

    // Add metadata
    tokenData.dataSource = Array.from(new Set(dataSources));
    tokenData.lastUpdated = new Date();

    return tokenData as TokenData;
  }

  private buildWalletData(aggregationResults: Map<string, FieldAggregationResult>): WalletData {
    const walletData: Partial<WalletData> = {};
    const dataSources: string[] = [];

    for (const [field, result] of aggregationResults.entries()) {
      (walletData as any)[field] = result.value;
      dataSources.push(...result.sources);
    }

    // Add metadata
    walletData.dataSource = Array.from(new Set(dataSources));
    walletData.lastUpdated = new Date();

    return walletData as WalletData;
  }

  private buildResponseMetadata(
    executions: ProviderExecution[],
    startTime: number,
    routingPlan: Map<string, RoutingPlan>,
  ): ResponseMetadata {
    const dataSources = executions.filter((e) => e.success).map((e) => e.provider);

    const providerHealth: Record<string, boolean> = {};
    for (const execution of executions) {
      providerHealth[execution.provider] = execution.success;
    }

    const responseTime = Math.max(1, Date.now() - startTime); // Ensure at least 1ms

    return {
      dataSources: Array.from(new Set(dataSources)),
      cacheStatus: 'miss', // TODO: Implement cache status tracking
      responseTime,
      timestamp: new Date(),
      providerHealth,
    };
  }

  private extractErrors(executions: ProviderExecution[]) {
    return executions
      .filter((e) => !e.success && e.error)
      .map((e) => ({
        provider: e.provider,
        error: e.error!.message,
        recoverable: true, // Most provider errors are recoverable
      }));
  }
}
