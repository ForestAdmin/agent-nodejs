import {
  Aggregator,
  Collection,
  CollectionUtils,
  ColumnSchema,
  ColumnType,
  ConditionTree,
  ConditionTreeBranch,
  ConditionTreeLeaf,
  Operator,
  PlainConditionTreeLeaf,
} from '@forestadmin/datasource-toolkit';

export default class ConditionTreeParser {
  static fromPlainObject(collection: Collection, json: unknown): ConditionTree {
    if (this.isLeaf(json)) {
      const operator = this.toPascalCase(json.operator);
      const value = this.parseValue(collection, { ...json, operator });

      return new ConditionTreeLeaf(json.field, operator, value);
    }

    if (this.isBranch(json)) {
      const aggregator = this.toPascalCase(json.aggregator) as Aggregator;
      const conditions = json.conditions.map(subTree => this.fromPlainObject(collection, subTree));

      return conditions.length !== 1
        ? new ConditionTreeBranch(aggregator, conditions)
        : conditions[0];
    }

    throw new Error('Failed to instantiate condition tree from json');
  }

  private static parseValue(collection: Collection, leaf: PlainConditionTreeLeaf): unknown {
    const schema = CollectionUtils.getFieldSchema(collection, leaf.field) as ColumnSchema;
    const expectedType = this.getExpectedTypeForCondition(leaf, schema);

    return this.castToType(leaf.value, expectedType);
  }

  /** Convert snake_case to PascalCase */
  private static toPascalCase(value: string): Operator {
    const pascalCased =
      value.slice(0, 1).toUpperCase() +
      value.slice(1).replace(/_[a-z]/g, match => match.slice(1).toUpperCase());

    return pascalCased as Operator;
  }

  private static getExpectedTypeForCondition(
    filter: PlainConditionTreeLeaf,
    fieldSchema: ColumnSchema,
  ): ColumnType {
    const operatorsExpectingNumber: Operator[] = [
      'ShorterThan',
      'LongerThan',
      'AfterXHoursAgo',
      'BeforeXHoursAgo',
      'PreviousXDays',
      'PreviousXDaysToDate',
    ];

    if (operatorsExpectingNumber.includes(filter.operator)) {
      return 'Number';
    }

    if (filter.operator === 'In') {
      return [fieldSchema.columnType];
    }

    return fieldSchema.columnType;
  }

  private static castToType(value: unknown, expectedType: ColumnType): unknown {
    if (value === null || value === undefined) return value;

    if (Array.isArray(expectedType)) {
      const items = typeof value === 'string' ? value.split(',').map(item => item.trim()) : value;
      const filter = expectedType[0] === 'Number' ? item => !Number.isNaN(item) : () => true;

      return Array.isArray(items)
        ? items.map(item => this.castToType(item, expectedType[0])).filter(filter)
        : value;
    }

    switch (expectedType) {
      case 'String':
      case 'Dateonly':
      case 'Date':
        return `${value as string | number}`;
      case 'Number':
        return Number(value);
      case 'Boolean':
        return typeof value === 'string'
          ? !['no', 'false', '0'].includes(value.toLowerCase())
          : !!value;

      default:
        return value;
    }
  }

  private static isLeaf(raw: unknown): raw is { field: string; operator: string; value: unknown } {
    return typeof raw === 'object' && 'field' in raw && 'operator' in raw;
  }

  private static isBranch(raw: unknown): raw is { aggregator: string; conditions: unknown[] } {
    return typeof raw === 'object' && 'aggregator' in raw && 'conditions' in raw;
  }
}
