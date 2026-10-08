import { SchemaManagerOptions, SchemaOperation } from '../types';
import { PermissionValidator } from '../validators/permission-validator';
import { IdentifierValidator } from '../validators/identifier-validator';

/**
 * Common validation logic for actions
 */
export class ActionHelpers {
  static async validatePermissions(
    caller: any,
    options: SchemaManagerOptions,
  ): Promise<{ isValid: boolean; error?: string }> {
    const permValidator = new PermissionValidator(options);
    const permResult = permValidator.validate(caller);

    if (!permResult.isValid) {
      return { isValid: false, error: permResult.errors.join(', ') };
    }

    return { isValid: true };
  }

  static validateIdentifier(
    name: string,
    type: 'table' | 'column' = 'column',
    options: SchemaManagerOptions = {},
  ): { isValid: boolean; error?: string; warnings?: string[] } {
    const validator = new IdentifierValidator();

    const result =
      type === 'table'
        ? validator.validateTableName(name, options.forbiddenTables)
        : validator.validateColumnName(name, options.forbiddenColumns);

    if (!result.isValid) {
      return { isValid: false, error: result.errors.join(', '), warnings: result.warnings };
    }

    return { isValid: true, warnings: result.warnings };
  }

  static async runWithCallbacks(
    operation: SchemaOperation,
    options: SchemaManagerOptions,
    executeFunc: () => Promise<void>,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Before callback
      if (options.beforeSchemaChange) {
        const proceed = await options.beforeSchemaChange(operation);
        if (!proceed) {
          return { success: false, error: 'Operation cancelled by beforeSchemaChange hook' };
        }
      }

      // Execute
      await executeFunc();

      // After callback
      if (options.afterSchemaChange) {
        await options.afterSchemaChange(operation);
      }

      return { success: true };
    } catch (error: any) {
      // Error callback
      if (options.onError) {
        await options.onError(error, operation);
      }

      return { success: false, error: error.message };
    }
  }

  static formatSuccessMessage(operation: SchemaOperation, customMessage?: string): string {
    if (customMessage) return customMessage;

    switch (operation.type) {
      case 'CREATE_TABLE':
        return `✅ Table "${operation.collection}" created successfully`;
      case 'DROP_TABLE':
        return `✅ Table "${operation.collection}" dropped successfully`;
      case 'CREATE_COLUMN':
        return `✅ Column "${operation.details.columnName}" created in "${operation.collection}"`;
      case 'DROP_COLUMN':
        return `✅ Column "${operation.details.columnName}" dropped from "${operation.collection}"`;
      case 'CREATE_INDEX':
        return `✅ Index created on "${operation.collection}"`;
      default:
        return `✅ Operation ${operation.type} completed successfully`;
    }
  }
}
