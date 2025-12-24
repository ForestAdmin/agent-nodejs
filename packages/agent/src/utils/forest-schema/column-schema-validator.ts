import type { ColumnSchema } from '@forestadmin/datasource-toolkit';

import { ValidationError } from '@forestadmin/datasource-toolkit';

export default class ColumnSchemaValidator {
  static validate(column: ColumnSchema, name: string): void {
    if (!column.enumValues) return;

    if (!Array.isArray(column.enumValues) || !column.enumValues.every(v => typeof v === 'string')) {
      throw new ValidationError(
        `The enumValues of column '${name}' must be an array of string instead of ${JSON.stringify(
          column.enumValues,
        )}`,
      );
    }
  }
}
