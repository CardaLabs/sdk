import type { AssetUnit, CardanoAddress } from '@/types/common';
import { ValidationError } from '@/types/errors';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class CardanoValidator {
  /**
   * Validate Cardano bech32 address
   */
  static validateAddress(address: string): ValidationResult {
    const errors: string[] = [];

    if (!address) {
      errors.push('Address is required');
      return { valid: false, errors };
    }

    if (typeof address !== 'string') {
      errors.push('Address must be a string');
      return { valid: false, errors };
    }

    // Check if it starts with addr (mainnet) or addr_test (testnet)
    if (!address.startsWith('addr')) {
      errors.push('Address must be a bech32 payment address starting with "addr"');
    }

    // Basic length check (Cardano addresses are typically 103 characters)
    if (address.length < 50 || address.length > 120) {
      errors.push('Address length is invalid');
    }

    // Check for valid bech32 characters
    const bech32Regex = /^[a-z0-9]+$/;
    if (!bech32Regex.test(address)) {
      errors.push('Address contains invalid characters');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate asset unit (policyId + assetNameHex or 'lovelace')
   */
  static validateAssetUnit(assetUnit: string): ValidationResult {
    const errors: string[] = [];

    if (!assetUnit) {
      errors.push('Asset unit is required');
      return { valid: false, errors };
    }

    if (typeof assetUnit !== 'string') {
      errors.push('Asset unit must be a string');
      return { valid: false, errors };
    }

    // Special case for ADA
    if (assetUnit === 'lovelace') {
      return { valid: true, errors: [] };
    }

    // Check minimum length (policy ID is 56 characters)
    if (assetUnit.length < 56) {
      errors.push('Asset unit must be at least 56 characters (policy ID length)');
    }

    // Check for valid hex characters
    const hexRegex = /^[a-fA-F0-9]+$/;
    if (!hexRegex.test(assetUnit)) {
      errors.push('Asset unit must contain only hexadecimal characters');
    }

    // Check if policy ID part is valid (first 56 characters)
    if (assetUnit.length >= 56) {
      const policyId = assetUnit.substring(0, 56);
      if (!hexRegex.test(policyId)) {
        errors.push('Policy ID part of asset unit is invalid');
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate policy ID
   */
  static validatePolicyId(policyId: string): ValidationResult {
    const errors: string[] = [];

    if (!policyId) {
      errors.push('Policy ID is required');
      return { valid: false, errors };
    }

    if (typeof policyId !== 'string') {
      errors.push('Policy ID must be a string');
      return { valid: false, errors };
    }

    // Policy ID must be exactly 56 characters
    if (policyId.length !== 56) {
      errors.push('Policy ID must be exactly 56 characters');
    }

    // Check for valid hex characters
    const hexRegex = /^[a-fA-F0-9]+$/;
    if (!hexRegex.test(policyId)) {
      errors.push('Policy ID must contain only hexadecimal characters');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate transaction hash
   */
  static validateTxHash(txHash: string): ValidationResult {
    const errors: string[] = [];

    if (!txHash) {
      errors.push('Transaction hash is required');
      return { valid: false, errors };
    }

    if (typeof txHash !== 'string') {
      errors.push('Transaction hash must be a string');
      return { valid: false, errors };
    }

    // Transaction hash must be exactly 64 characters
    if (txHash.length !== 64) {
      errors.push('Transaction hash must be exactly 64 characters');
    }

    // Check for valid hex characters
    const hexRegex = /^[a-fA-F0-9]+$/;
    if (!hexRegex.test(txHash)) {
      errors.push('Transaction hash must contain only hexadecimal characters');
    }

    return { valid: errors.length === 0, errors };
  }
}

export class DataValidator {
  /**
   * Validate that a value is a positive number
   */
  static validatePositiveNumber(value: unknown, fieldName: string): ValidationResult {
    const errors: string[] = [];

    if (value === undefined || value === null) {
      errors.push(`${fieldName} is required`);
      return { valid: false, errors };
    }

    if (typeof value !== 'number') {
      errors.push(`${fieldName} must be a number`);
      return { valid: false, errors };
    }

    if (isNaN(value)) {
      errors.push(`${fieldName} must be a valid number`);
    }

    if (value <= 0) {
      errors.push(`${fieldName} must be greater than 0`);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate that a value is a non-negative number
   */
  static validateNonNegativeNumber(value: unknown, fieldName: string): ValidationResult {
    const errors: string[] = [];

    if (value === undefined || value === null) {
      errors.push(`${fieldName} is required`);
      return { valid: false, errors };
    }

    if (typeof value !== 'number') {
      errors.push(`${fieldName} must be a number`);
      return { valid: false, errors };
    }

    if (isNaN(value)) {
      errors.push(`${fieldName} must be a valid number`);
    }

    if (value < 0) {
      errors.push(`${fieldName} must be non-negative`);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate string is not empty
   */
  static validateNonEmptyString(value: unknown, fieldName: string): ValidationResult {
    const errors: string[] = [];

    if (value === undefined || value === null) {
      errors.push(`${fieldName} is required`);
      return { valid: false, errors };
    }

    if (typeof value !== 'string') {
      errors.push(`${fieldName} must be a string`);
      return { valid: false, errors };
    }

    if (value.trim().length === 0) {
      errors.push(`${fieldName} cannot be empty`);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate array is not empty
   */
  static validateNonEmptyArray(value: unknown, fieldName: string): ValidationResult {
    const errors: string[] = [];

    if (value === undefined || value === null) {
      errors.push(`${fieldName} is required`);
      return { valid: false, errors };
    }

    if (!Array.isArray(value)) {
      errors.push(`${fieldName} must be an array`);
      return { valid: false, errors };
    }

    if (value.length === 0) {
      errors.push(`${fieldName} cannot be empty`);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate date is valid
   */
  static validateDate(value: unknown, fieldName: string): ValidationResult {
    const errors: string[] = [];

    if (value === undefined || value === null) {
      errors.push(`${fieldName} is required`);
      return { valid: false, errors };
    }

    let date: Date;

    if (value instanceof Date) {
      date = value;
    } else if (typeof value === 'string' || typeof value === 'number') {
      date = new Date(value);
    } else {
      errors.push(`${fieldName} must be a Date, string, or number`);
      return { valid: false, errors };
    }

    if (isNaN(date.getTime())) {
      errors.push(`${fieldName} must be a valid date`);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate value is one of allowed options
   */
  static validateEnum<T>(
    value: unknown,
    allowedValues: readonly T[],
    fieldName: string,
  ): ValidationResult {
    const errors: string[] = [];

    if (value === undefined || value === null) {
      errors.push(`${fieldName} is required`);
      return { valid: false, errors };
    }

    if (!allowedValues.includes(value as T)) {
      errors.push(`${fieldName} must be one of: ${allowedValues.map((v) => String(v)).join(', ')}`);
    }

    return { valid: errors.length === 0, errors };
  }
}

export function validateAssetUnit(assetUnit: string): void {
  const result = CardanoValidator.validateAssetUnit(assetUnit);
  if (!result.valid) {
    throw new ValidationError(
      `Invalid asset unit: ${result.errors.join(', ')}`,
      undefined,
      undefined,
      { errors: result.errors },
    );
  }
}

export function validateCardanoAddress(address: string): void {
  const result = CardanoValidator.validateAddress(address);
  if (!result.valid) {
    throw new ValidationError(
      `Invalid Cardano address: ${result.errors.join(', ')}`,
      undefined,
      undefined,
      { errors: result.errors },
    );
  }
}

export class CompositeValidator {
  private validators: Array<() => ValidationResult> = [];

  /**
   * Add a validator function
   */
  add(validator: () => ValidationResult): this {
    this.validators.push(validator);
    return this;
  }

  /**
   * Add Cardano address validation
   */
  validateAddress(address: string): this {
    this.add(() => CardanoValidator.validateAddress(address));
    return this;
  }

  /**
   * Add asset unit validation
   */
  validateAssetUnit(assetUnit: string): this {
    this.add(() => CardanoValidator.validateAssetUnit(assetUnit));
    return this;
  }

  /**
   * Add positive number validation
   */
  validatePositiveNumber(value: unknown, fieldName: string): this {
    this.add(() => DataValidator.validatePositiveNumber(value, fieldName));
    return this;
  }

  /**
   * Add non-empty string validation
   */
  validateNonEmptyString(value: unknown, fieldName: string): this {
    this.add(() => DataValidator.validateNonEmptyString(value, fieldName));
    return this;
  }

  /**
   * Run all validators and collect results
   */
  validate(): ValidationResult {
    const allErrors: string[] = [];

    for (const validator of this.validators) {
      const result = validator();
      if (!result.valid) {
        allErrors.push(...result.errors);
      }
    }

    return {
      valid: allErrors.length === 0,
      errors: allErrors,
    };
  }

  /**
   * Run validators and throw ValidationError if any fail
   */
  validateOrThrow(): void {
    const result = this.validate();
    if (!result.valid) {
      throw new ValidationError(
        `Validation failed: ${result.errors.join(', ')}`,
        undefined,
        undefined,
        { errors: result.errors },
      );
    }
  }
}
