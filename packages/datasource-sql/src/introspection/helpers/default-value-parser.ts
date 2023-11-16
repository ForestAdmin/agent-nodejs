import { Dialect, literal } from 'sequelize';

import { ColumnDescription } from '../dialects/dialect.interface';
import { ColumnType } from '../types';

export default class DefaultValueParser {
  static parse(column: ColumnDescription, type: ColumnType): unknown {
    if (column.defaultValue === null || column.defaultValue === undefined) return undefined;

    if (column.isLiteralDefaultValue) return literal(column.defaultValue);

    try {
      const result = this.parseGeneric(column, type);

      return result !== undefined ? result : literal(column.defaultValue);
    } catch (e) {
      return literal(column.defaultValue);
    }
  }

  private static parseGeneric(column: ColumnDescription, columnType: ColumnType): unknown {
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
        return this.parseNumber(column.defaultValue);

      case 'DATE':
      case 'DATEONLY':
      case 'STRING':
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
