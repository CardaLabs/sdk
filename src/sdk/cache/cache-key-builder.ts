/**
 * Cache key builder implementation
 */
import { createHash } from 'crypto';

import type { CacheKeyBuilder, CacheKeyMetadata } from './cache.interface';

/**
 * Default cache key builder implementation
 */
export class DefaultCacheKeyBuilder implements CacheKeyBuilder {
  private readonly separator = ':';
  private readonly version = 'v1';

  buildTokenDataKey(assetUnit: string, fields?: string[], provider?: string): string {
    const parts = [this.version, 'token', this.sanitizeIdentifier(assetUnit)];

    if (provider) {
      parts.push('provider', this.sanitizeIdentifier(provider));
    }

    if (fields && fields.length > 0) {
      const sortedFields = [...fields].sort();
      const fieldsHash = this.hashFields(sortedFields);
      parts.push('fields', fieldsHash);
    }

    return parts.join(this.separator);
  }

  buildWalletDataKey(address: string, fields?: string[], provider?: string): string {
    const parts = [this.version, 'wallet', this.sanitizeIdentifier(address)];

    if (provider) {
      parts.push('provider', this.sanitizeIdentifier(provider));
    }

    if (fields && fields.length > 0) {
      const sortedFields = [...fields].sort();
      const fieldsHash = this.hashFields(sortedFields);
      parts.push('fields', fieldsHash);
    }

    return parts.join(this.separator);
  }

  buildAggregatedKey(
    type: 'token' | 'wallet',
    identifier: string,
    fields?: string[],
    providers?: string[],
  ): string {
    const parts = [this.version, 'aggregated', type, this.sanitizeIdentifier(identifier)];

    if (providers && providers.length > 0) {
      const sortedProviders = [...providers].sort();
      const providersHash = this.hashFields(sortedProviders);
      parts.push('providers', providersHash);
    }

    if (fields && fields.length > 0) {
      const sortedFields = [...fields].sort();
      const fieldsHash = this.hashFields(sortedFields);
      parts.push('fields', fieldsHash);
    }

    return parts.join(this.separator);
  }

  parseKey(key: string): CacheKeyMetadata | null {
    try {
      const parts = key.split(this.separator);

      if (parts.length < 3 || parts[0] !== this.version) {
        return null;
      }

      // Check if this is an aggregated key
      if (parts[1] === 'aggregated') {
        if (parts.length < 4) {
          return null;
        }

        const type = parts[2] as 'token' | 'wallet';
        const identifier = parts[3];

        const metadata: CacheKeyMetadata = {
          type: 'aggregated',
          identifier: identifier || '',
        };

        // Parse additional parts
        for (let i = 4; i < parts.length; i += 2) {
          const key = parts[i];
          const value = parts[i + 1];

          if (!value) continue;

          switch (key) {
            case 'providers':
              // We can't reverse the hash, but we know it's there
              metadata.providers = ['multiple'];
              break;
            case 'fields':
              // We can't reverse the hash, but we know it's there
              metadata.fields = ['multiple'];
              break;
          }
        }

        return metadata;
      }

      // Regular token or wallet key
      const type = parts[1] as 'token' | 'wallet';
      const identifier = parts[2];

      const metadata: CacheKeyMetadata = {
        type,
        identifier: identifier || '',
      };

      // Parse additional parts
      for (let i = 3; i < parts.length; i += 2) {
        const key = parts[i];
        const value = parts[i + 1];

        if (!value) continue;

        switch (key) {
          case 'provider':
            metadata.provider = value;
            break;
          case 'fields':
            // We can't reverse the hash, but we know it's there
            metadata.fields = ['multiple'];
            break;
        }
      }

      return metadata;
    } catch (error) {
      return null;
    }
  }

  /**
   * Create key for provider-specific caching
   */
  buildProviderKey(provider: string, endpoint: string, params?: Record<string, any>): string {
    const parts = [
      this.version,
      'provider',
      this.sanitizeIdentifier(provider),
      this.sanitizeIdentifier(endpoint),
    ];

    if (params && Object.keys(params).length > 0) {
      const paramsHash = this.hashObject(params);
      parts.push('params', paramsHash);
    }

    return parts.join(this.separator);
  }

  /**
   * Create key for health check results
   */
  buildHealthCheckKey(provider: string): string {
    return [this.version, 'health', this.sanitizeIdentifier(provider)].join(this.separator);
  }

  /**
   * Get all keys matching a pattern
   */
  buildPattern(
    type: 'token' | 'wallet' | 'aggregated' | 'provider' | 'health',
    identifier?: string,
  ): string {
    const parts = [this.version, type];

    if (identifier) {
      parts.push(this.sanitizeIdentifier(identifier));
    }

    return parts.join(this.separator) + '*';
  }

  private sanitizeIdentifier(identifier: string): string {
    // Remove or replace characters that might cause issues in cache keys
    return identifier.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  }

  private hashFields(fields: string[]): string {
    const fieldsString = fields.join(',');
    return createHash('md5').update(fieldsString).digest('hex').substring(0, 8);
  }

  private hashObject(obj: Record<string, any>): string {
    // Sort keys for consistent hashing
    const sortedKeys = Object.keys(obj).sort();
    const sortedObj = sortedKeys.reduce(
      (result, key) => {
        result[key] = obj[key];
        return result;
      },
      {} as Record<string, any>,
    );

    const objString = JSON.stringify(sortedObj);
    return createHash('md5').update(objString).digest('hex').substring(0, 8);
  }
}

/**
 * Simple cache key builder for basic use cases
 */
export class SimpleCacheKeyBuilder implements CacheKeyBuilder {
  buildTokenDataKey(assetUnit: string): string {
    return `token:${assetUnit}`;
  }

  buildWalletDataKey(address: string): string {
    return `wallet:${address}`;
  }

  buildAggregatedKey(type: 'token' | 'wallet', identifier: string): string {
    return `aggregated:${type}:${identifier}`;
  }

  parseKey(key: string): CacheKeyMetadata | null {
    const parts = key.split(':');

    if (parts.length < 2) {
      return null;
    }

    if (parts[0] === 'aggregated') {
      return {
        type: 'aggregated',
        identifier: parts.slice(2).join(':'),
      };
    }

    return {
      type: parts[0] as 'token' | 'wallet',
      identifier: parts.slice(1).join(':'),
    };
  }
}
