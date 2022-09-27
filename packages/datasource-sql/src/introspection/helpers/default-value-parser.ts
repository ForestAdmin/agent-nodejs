import { Dialect, literal } from 'sequelize';

import { ColumnType } from '../types';

export default class DefaultValueParser {
  private readonly dialect: Dialect;

  constructor(dialect: Dialect) {
    this.dialect = dialect;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parse(expression: any, columnType: ColumnType): unknown {
    if (expression === null || expression === undefined) return undefined;

    if (typeof expression === 'string' && expression.startsWith('NULL')) return null;

    // FA backend not handle correctly
    if (columnType.type === 'array') return undefined;

    try {
      const result = this.parseGeneric(expression, columnType);

      return result !== undefined ? result : literal(expression);
    } catch (e) {
      return literal(expression);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private parseGeneric(expression: any, columnType: ColumnType): unknown {
    let sanitizedExpression = expression;

    // sanitize string
    if (typeof expression === 'string') {
      sanitizedExpression = this.sanitizeExpression(expression);
    }

    if (columnType.type === 'enum') {
      return sanitizedExpression;
    }

    switch (columnType.subType) {
      case 'BOOLEAN':
        return [true, 'true', 'TRUE', "b'1'", '1'].includes(sanitizedExpression);

      case 'NUMBER':
      case 'BIGINT':
      case 'FLOAT':
      case 'DOUBLE':
        return this.parseNumber(sanitizedExpression);

      case 'DATE':
      case 'DATEONLY':
        return this.literalUnlessMatch(
          /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})|(\d{4}-\d{2}-\d{2})|(\d{2}:\d{2}:\d{2})$/,
          sanitizedExpression,
        );

      case 'STRING':
        return sanitizedExpression;

      case 'JSON':
      case 'JSONB':
        return JSON.parse(sanitizedExpression);

      default:
        return undefined;
    }
  }

  private sanitizeExpression(expression: string): string {
    let sanitizedExpression = expression;

    if (/^'.*'$/.test(sanitizedExpression)) {
      sanitizedExpression = expression.substring(1, expression.length - 1);
    }

    if (this.dialect === 'mssql') {
      // Sequelize send default values with weird char at the beginning (`(Ndefault value`)
      sanitizedExpression = sanitizedExpression.replace(/\(N/, '');

      while (/^\(.*\)$/.test(sanitizedExpression)) {
        sanitizedExpression = sanitizedExpression.substring(1, sanitizedExpression.length - 1);
      }
    }

    return sanitizedExpression;
  }

  private literalUnlessMatch(regexp: RegExp, expression: string) {
    return regexp.test(expression) ? expression : literal(expression);
  }

  private parseNumber(expression: string) {
    const result = Number.parseFloat(expression);

    return Number.isNaN(result) ? literal(expression) : result;
  }
}
