/**
 * Base provider interface that all data providers must implement
 */
import type {
  AssetUnit,
  CardanoAddress,
  RequestOptions,
  TokenData,
  WalletData,
} from '@/types/common';
import type { ProviderResponse } from '@/types/providers';
import type { ProviderCapabilities, ProviderHealth } from '@/types/sdk';

/**
 * Base interface that all providers must implement
 */
export interface DataProvider {
  /**
   * Provider identification
   */
  readonly name: string;
  readonly version: string;

  /**
   * Provider capabilities declaration
   */
  readonly capabilities: ProviderCapabilities;

  /**
   * Initialize the provider with configuration
   */
  initialize(config: Record<string, unknown>): Promise<void>;

  /**
   * Check if the provider is properly configured and healthy
   */
  healthCheck(): Promise<ProviderHealth>;

  /**
   * Get token data for a specific asset
   * Should return partial data based on provider capabilities
   */
  getTokenData(
    assetUnit: AssetUnit,
    options?: RequestOptions,
  ): Promise<ProviderResponse<Partial<TokenData>>>;

  /**
   * Get wallet data for a specific address
   * Should return partial data based on provider capabilities
   */
  getWalletData(
    address: CardanoAddress,
    options?: RequestOptions,
  ): Promise<ProviderResponse<Partial<WalletData>>>;

  /**
   * Get batch token data for multiple assets (if supported)
   */
  getTokenDataBatch?(
    assetUnits: AssetUnit[],
    options?: RequestOptions,
  ): Promise<ProviderResponse<Record<AssetUnit, Partial<TokenData>>>>;

  /**
   * Get historical token data (if supported)
   */
  getTokenDataHistorical?(
    assetUnit: AssetUnit,
    from: Date,
    to: Date,
    options?: RequestOptions,
  ): Promise<ProviderResponse<Array<TokenData & { timestamp: Date }>>>;

  /**
   * Get real-time token data stream (if supported)
   */
  getTokenDataStream?(
    assetUnit: AssetUnit,
    callback: (data: Partial<TokenData>) => void,
    options?: RequestOptions,
  ): Promise<() => void>; // Returns unsubscribe function

  /**
   * Cleanup resources
   */
  destroy(): Promise<void>;
}

/**
 * Provider factory interface for creating provider instances
 */
export interface ProviderFactory {
  create(config: Record<string, unknown>): DataProvider;
  validate(config: Record<string, unknown>): boolean;
}

/**
 * Provider metadata for registration
 */
export interface ProviderMetadata {
  name: string;
  description: string;
  version: string;
  author: string;
  homepage?: string;
  documentation?: string;
  tags?: string[];
}

/**
 * Provider lifecycle hooks
 */
export interface ProviderHooks {
  onInitialize?(provider: DataProvider): Promise<void>;
  onDestroy?(provider: DataProvider): Promise<void>;
  onError?(provider: DataProvider, error: Error): Promise<void>;
  onHealthCheck?(provider: DataProvider, health: ProviderHealth): Promise<void>;
}

/**
 * Base abstract provider class with common functionality
 */
export abstract class BaseProvider implements DataProvider {
  abstract readonly name: string;
  abstract readonly version: string;
  abstract readonly capabilities: ProviderCapabilities;

  protected config: Record<string, unknown> = {};
  protected initialized = false;
  protected destroyed = false;

  async initialize(config: Record<string, unknown>): Promise<void> {
    if (this.initialized) {
      throw new Error(`Provider ${this.name} already initialized`);
    }

    this.config = { ...config };
    await this.onInitialize();
    this.initialized = true;
  }

  async destroy(): Promise<void> {
    if (this.destroyed) {
      return;
    }

    await this.onDestroy();
    this.destroyed = true;
    this.initialized = false;
  }

  protected ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(`Provider ${this.name} not initialized`);
    }

    if (this.destroyed) {
      throw new Error(`Provider ${this.name} has been destroyed`);
    }
  }

  // Abstract methods to be implemented by concrete providers
  protected abstract onInitialize(): Promise<void>;
  protected abstract onDestroy(): Promise<void>;

  abstract healthCheck(): Promise<ProviderHealth>;
  abstract getTokenData(
    assetUnit: AssetUnit,
    options?: RequestOptions,
  ): Promise<ProviderResponse<Partial<TokenData>>>;
  abstract getWalletData(
    address: CardanoAddress,
    options?: RequestOptions,
  ): Promise<ProviderResponse<Partial<WalletData>>>;
}

/**
 * Provider registry for managing available providers
 */
export interface ProviderRegistry {
  /**
   * Register a new provider
   */
  register(name: string, factory: ProviderFactory, metadata?: ProviderMetadata): void;

  /**
   * Unregister a provider
   */
  unregister(name: string): void;

  /**
   * Get available provider names
   */
  getAvailableProviders(): string[];

  /**
   * Create a provider instance
   */
  createProvider(name: string, config: Record<string, unknown>): DataProvider;

  /**
   * Get provider metadata
   */
  getProviderMetadata(name: string): ProviderMetadata | undefined;

  /**
   * Validate provider configuration
   */
  validateConfig(name: string, config: Record<string, unknown>): boolean;
}
