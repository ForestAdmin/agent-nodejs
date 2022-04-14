import {
  AbstractDataType,
  AbstractDataTypeConstructor,
  DataTypes,
  Dialect,
  literal,
} from 'sequelize';

export default class DefaultValueParser {
  private readonly dialect: Dialect;

  constructor(dialect: Dialect) {
    this.dialect = dialect;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parse(expression: any, type: AbstractDataType | AbstractDataTypeConstructor): unknown {
    if (expression === null || expression === undefined) return undefined;

    if (typeof expression === 'string' && expression.startsWith('NULL')) return null;

    // FA backend not handle correctly
    if (type instanceof DataTypes.ARRAY) {
      return undefined;
    }

    try {
      const result = this.parseGeneric(expression, type);

      return result !== undefined ? result : literal(expression);
    } catch (e) {
      return literal(expression);
    }
  }

  private parseGeneric(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expression: any,
    type: AbstractDataType | AbstractDataTypeConstructor,
  ): unknown {
    let sanitizedExpression = expression;

    // sanitize string
    if (typeof expression === 'string') {
      sanitizedExpression = this.sanitizeExpression(expression);
    }

    if (type instanceof DataTypes.ENUM) {
      return sanitizedExpression;
    }

    switch (type) {
      case DataTypes.BOOLEAN:
        return [true, 'true', 'TRUE', "b'1'", '1'].includes(sanitizedExpression);

      case DataTypes.NUMBER:
      case DataTypes.BIGINT:
      case DataTypes.FLOAT:
      case DataTypes.DOUBLE:
        return this.parseNumber(sanitizedExpression);

      case DataTypes.DATE:
      case DataTypes.DATEONLY:
        return this.literalUnlessMatch(
          /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})|(\d{4}-\d{2}-\d{2})|(\d{2}:\d{2}:\d{2})$/,
          sanitizedExpression,
        );

      case DataTypes.STRING:
        return sanitizedExpression;

      case DataTypes.JSON:
      case DataTypes.JSONB:
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
