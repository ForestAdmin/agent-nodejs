import { Caller } from '@forestadmin/datasource-toolkit';
import { SchemaManagerOptions, ValidationResult } from '../types';

export class PermissionValidator {
  constructor(private options: SchemaManagerOptions) {}

  /**
   * Validate that the caller has sufficient permissions
   */
  validate(caller: Caller): ValidationResult {
    const restrictTo = this.options.restrictTo || ['admin', 'developer'];

    if (!restrictTo.includes(caller.permissionLevel)) {
      return {
        isValid: false,
        errors: [
          `Insufficient permissions. Required: ${restrictTo.join(' or ')}. ` +
            `You have: ${caller.permissionLevel}`,
        ],
      };
    }

    return { isValid: true, errors: [] };
  }

  /**
   * Check if a specific permission level is allowed
   */
  hasPermission(
    permissionLevel: 'admin' | 'developer' | 'editor' | 'user',
  ): boolean {
    const restrictTo = this.options.restrictTo || ['admin', 'developer'];
    return restrictTo.includes(permissionLevel);
  }
}
