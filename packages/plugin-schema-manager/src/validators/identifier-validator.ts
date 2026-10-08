import { ValidationResult } from '../types';

export class IdentifierValidator {
  private readonly SQL_RESERVED_WORDS = new Set([
    // SQL Standard reserved words
    'SELECT',
    'FROM',
    'WHERE',
    'INSERT',
    'UPDATE',
    'DELETE',
    'DROP',
    'CREATE',
    'ALTER',
    'TABLE',
    'INDEX',
    'VIEW',
    'TRIGGER',
    'PROCEDURE',
    'FUNCTION',
    'DATABASE',
    'SCHEMA',
    'USER',
    'GROUP',
    'ROLE',
    'GRANT',
    'REVOKE',
    'ORDER',
    'BY',
    'AND',
    'OR',
    'NOT',
    'NULL',
    'IS',
    'AS',
    'IN',
    'LIKE',
    'BETWEEN',
    'EXISTS',
    'CASE',
    'WHEN',
    'THEN',
    'ELSE',
    'END',
    'JOIN',
    'INNER',
    'OUTER',
    'LEFT',
    'RIGHT',
    'FULL',
    'CROSS',
    'ON',
    'USING',
    'UNION',
    'INTERSECT',
    'EXCEPT',
    'ALL',
    'DISTINCT',
    'PRIMARY',
    'FOREIGN',
    'KEY',
    'UNIQUE',
    'CHECK',
    'DEFAULT',
    'CONSTRAINT',
    'REFERENCES',
    'CASCADE',
    'RESTRICT',
    'SET',
    'ADD',
    'COLUMN',
    'MODIFY',
    'CHANGE',
    'RENAME',
    'DESCRIBE',
    'SHOW',
    'USE',
    'COMMIT',
    'ROLLBACK',
    'TRANSACTION',
    'BEGIN',
    'START',
    'SAVEPOINT',
    'RELEASE',
  ]);

  /**
   * Validate an identifier (table name, column name, etc.)
   */
  validateIdentifier(name: string, strict: boolean = false): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Empty
    if (!name || name.trim().length === 0) {
      errors.push('Identifier cannot be empty');
      return { isValid: false, errors, warnings };
    }

    const trimmed = name.trim();

    // Length
    if (trimmed.length > 63) {
      errors.push('Identifier too long (max 63 characters)');
    }

    // Format: must start with letter or underscore
    const validFormat = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    if (!validFormat.test(trimmed)) {
      errors.push(
        'Identifier must start with letter or underscore, and contain only alphanumeric characters and underscores',
      );
    }

    // Reserved words
    if (this.SQL_RESERVED_WORDS.has(trimmed.toUpperCase())) {
      if (strict) {
        errors.push(`"${trimmed}" is a reserved SQL keyword`);
      } else {
        warnings.push(`"${trimmed}" is a reserved SQL keyword (will be quoted)`);
      }
    }

    // Dangerous characters (SQL injection protection)
    const dangerous = /[';\"\\--/*]/;
    if (dangerous.test(trimmed)) {
      errors.push('Identifier contains dangerous characters');
    }

    // Check for common typos or bad practices
    if (trimmed.includes('__')) {
      warnings.push('Double underscores in identifier name (not recommended)');
    }

    if (/^\d/.test(trimmed)) {
      errors.push('Identifier cannot start with a number');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate a table name
   */
  validateTableName(name: string, forbiddenTables: string[] = []): ValidationResult {
    const result = this.validateIdentifier(name);

    if (forbiddenTables.map(t => t.toLowerCase()).includes(name.toLowerCase())) {
      result.errors.push(`Table "${name}" is protected and cannot be modified`);
      result.isValid = false;
    }

    return result;
  }

  /**
   * Validate a column name
   */
  validateColumnName(name: string, forbiddenColumns: string[] = []): ValidationResult {
    const result = this.validateIdentifier(name);

    if (forbiddenColumns.map(c => c.toLowerCase()).includes(name.toLowerCase())) {
      result.errors.push(`Column "${name}" is protected and cannot be modified`);
      result.isValid = false;
    }

    return result;
  }

  /**
   * Validate multiple identifiers at once
   */
  validateIdentifiers(names: string[]): ValidationResult {
    const allErrors: string[] = [];
    const allWarnings: string[] = [];

    for (const name of names) {
      const result = this.validateIdentifier(name);
      if (!result.isValid) {
        allErrors.push(...result.errors.map(e => `${name}: ${e}`));
      }
      if (result.warnings) {
        allWarnings.push(...result.warnings.map(w => `${name}: ${w}`));
      }
    }

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings,
    };
  }
}
