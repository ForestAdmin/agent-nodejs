import { ValidationResult } from '../types';

export class TypeValidator {
  /**
   * Validate that a type is supported by the executor
   */
  validateType(type: string, supportedTypes: string[]): ValidationResult {
    const typeUpper = type.toUpperCase();
    const supportedUpper = supportedTypes.map(t => t.toUpperCase());

    if (!supportedUpper.includes(typeUpper)) {
      return {
        isValid: false,
        errors: [
          `Type "${type}" is not supported. ` +
            `Supported types: ${supportedTypes.join(', ')}`,
        ],
      };
    }

    return { isValid: true, errors: [] };
  }

  /**
   * Check if a type change is safe (no data loss)
   */
  validateTypeChange(
    fromType: string,
    toType: string,
    dialect: string = 'generic',
  ): ValidationResult {
    const from = fromType.toUpperCase();
    const to = toType.toUpperCase();

    // Same type = always safe
    if (from === to) {
      return { isValid: true, errors: [], warnings: ['Same type, no change needed'] };
    }

    const warnings: string[] = [];

    // Define safe type conversions (no data loss)
    const safeConversions: Record<string, string[]> = {
      // String types
      CHAR: ['VARCHAR', 'STRING', 'TEXT'],
      VARCHAR: ['STRING', 'TEXT'],
      STRING: ['TEXT'],

      // Numeric types (safe upcast)
      INTEGER: ['BIGINT', 'FLOAT', 'DOUBLE', 'DECIMAL'],
      BIGINT: ['FLOAT', 'DOUBLE', 'DECIMAL'],
      FLOAT: ['DOUBLE'],

      // Date types
      DATE: ['DATEONLY', 'TIMESTAMP'],
      DATEONLY: ['DATE', 'TIMESTAMP'],
    };

    // Check if conversion is in safe list
    if (safeConversions[from]?.includes(to)) {
      return {
        isValid: true,
        errors: [],
        warnings: [`Type change from ${from} to ${to} is safe`],
      };
    }

    // Warn about potentially dangerous conversions
    const dangerousConversions = [
      { from: 'TEXT', to: 'VARCHAR', reason: 'May truncate long text' },
      { from: 'TEXT', to: 'CHAR', reason: 'May truncate long text' },
      { from: 'BIGINT', to: 'INTEGER', reason: 'May overflow for large numbers' },
      { from: 'DOUBLE', to: 'FLOAT', reason: 'May lose precision' },
      { from: 'DOUBLE', to: 'INTEGER', reason: 'Will lose decimal part' },
      { from: 'FLOAT', to: 'INTEGER', reason: 'Will lose decimal part' },
      { from: 'DECIMAL', to: 'INTEGER', reason: 'Will lose decimal part' },
      { from: 'STRING', to: 'INTEGER', reason: 'Will fail if string is not numeric' },
      { from: 'STRING', to: 'BOOLEAN', reason: 'May have unexpected results' },
      { from: 'DATE', to: 'STRING', reason: 'Will convert to string format' },
      { from: 'JSON', to: 'STRING', reason: 'Will serialize JSON to string' },
    ];

    const dangerous = dangerousConversions.find(
      d => d.from === from && d.to === to,
    );

    if (dangerous) {
      warnings.push(`⚠️  ${dangerous.reason}`);
      warnings.push('Consider backing up data before this conversion');
    }

    // If not in safe list and no specific warning, give generic warning
    if (!dangerous) {
      warnings.push(
        `Type conversion from ${from} to ${to} may cause data loss or errors`,
      );
      warnings.push('Test this change in a non-production environment first');
    }

    return {
      isValid: true,
      errors: [],
      warnings,
    };
  }

  /**
   * Validate a default value for a given type
   */
  validateDefaultValue(value: any, type: string): ValidationResult {
    const typeUpper = type.toUpperCase();

    // Null is always valid
    if (value === null || value === undefined) {
      return { isValid: true, errors: [] };
    }

    const errors: string[] = [];

    switch (typeUpper) {
      case 'INTEGER':
      case 'BIGINT':
        if (!Number.isInteger(Number(value))) {
          errors.push(`Default value "${value}" is not a valid integer`);
        }
        break;

      case 'FLOAT':
      case 'DOUBLE':
      case 'DECIMAL':
        if (isNaN(Number(value))) {
          errors.push(`Default value "${value}" is not a valid number`);
        }
        break;

      case 'BOOLEAN':
        if (typeof value !== 'boolean' && value !== 'true' && value !== 'false' && value !== 0 && value !== 1) {
          errors.push(`Default value "${value}" is not a valid boolean`);
        }
        break;

      case 'DATE':
      case 'DATEONLY':
      case 'TIMESTAMP':
        if (!(value instanceof Date) && isNaN(Date.parse(value))) {
          errors.push(`Default value "${value}" is not a valid date`);
        }
        break;

      case 'JSON':
      case 'JSONB':
        try {
          if (typeof value === 'string') {
            JSON.parse(value);
          }
        } catch {
          errors.push(`Default value "${value}" is not valid JSON`);
        }
        break;

      case 'UUID':
        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(String(value))) {
          errors.push(`Default value "${value}" is not a valid UUID`);
        }
        break;

      // String types - always valid
      case 'STRING':
      case 'TEXT':
      case 'CHAR':
      case 'VARCHAR':
        break;

      default:
        // Unknown type, allow it
        break;
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
