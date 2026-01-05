import type { ColumnDescription } from '../dialects/dialect.interface';
import type { ColumnType } from '../types';

import { literal } from 'sequelize';

export default class DefaultValueParser {
  static parse(
    column: Pick<ColumnDescription, 'defaultValue' | 'isLiteralDefaultValue' | 'enumValues'>,
    columnType: ColumnType,
  ): unknown {
    if (column.defaultValue === null || column.defaultValue === undefined) return undefined;

    if (columnType.type === 'array') return undefined;

    if (column.isLiteralDefaultValue) return literal(column.defaultValue);

    try {
      const result = this.parseGeneric(column, columnType);

      return result !== undefined ? result : literal(column.defaultValue);
    } catch (e) {
      return literal(column.defaultValue);
    }
  }

  private static parseGeneric(
    column: Pick<ColumnDescription, 'defaultValue' | 'isLiteralDefaultValue' | 'enumValues'>,
    columnType: ColumnType,
  ): unknown {
    if (columnType.type === 'enum') {
      return column.defaultValue;
    }

    switch (columnType.subType) {
      case 'BOOLEAN':
        return [true, 'true', 'TRUE', "b'1'", '1'].includes(column.defaultValue);

      case 'NUMBER':
      case 'BIGINT':
      case 'FLOAT':
      case 'DOUBLE':
      case 'INTEGER':
      case 'DECIMAL':
      case 'REAL':
        return this.parseNumber(column.defaultValue);

      case 'DATE':
      case 'DATEONLY':
      case 'STRING':
      case 'TEXT':
        return column.defaultValue;

      case 'JSON':
      case 'JSONB':
        return JSON.parse(column.defaultValue);

      default:
        return undefined;
    }
  }

  private static parseNumber(expression: string) {
    const result = Number.parseFloat(expression);

    return Number.isNaN(result) ? literal(expression) : result;
  }
}
