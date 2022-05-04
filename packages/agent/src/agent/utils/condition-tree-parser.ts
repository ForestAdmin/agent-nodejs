import {
  Aggregator,
  Collection,
  CollectionUtils,
  ColumnSchema,
  ConditionTree,
  ConditionTreeBranch,
  ConditionTreeLeaf,
  Operator,
} from '@forestadmin/datasource-toolkit';

export default class ConditionTreeParser {
  static fromPlainObject(collection: Collection, json: unknown): ConditionTree {
    if (ConditionTreeParser.isLeaf(json)) {
      const operator = ConditionTreeParser.toPascalCase(json.operator);
      const value = ConditionTreeParser.parseValue(collection, { ...json, operator });

      return new ConditionTreeLeaf(json.field, operator, value);
    }

    if (ConditionTreeParser.isBranch(json)) {
      const aggregator = ConditionTreeParser.toPascalCase(json.aggregator) as Aggregator;
      const conditions = json.conditions.map(subTree =>
        ConditionTreeParser.fromPlainObject(collection, subTree),
      );

      return conditions.length !== 1
        ? new ConditionTreeBranch(aggregator, conditions)
        : conditions[0];
    }

    throw new Error('Failed to instantiate condition tree from json');
  }

  /** Handle 'In' where the frontend unexpectedly sends strings */
  private static parseValue(
    collection: Collection,
    leaf: { field: string; operator: string; value: unknown },
  ): unknown {
    const schema = CollectionUtils.getFieldSchema(collection, leaf.field) as ColumnSchema;

    if (leaf.operator === 'In' && typeof leaf.value === 'string') {
      if (schema.columnType === 'Boolean') {
        return leaf.value
          .split(',')
          .map(bool => !['false', '0', 'no'].includes(bool.toLowerCase().trim()));
      }

      if (schema.columnType === 'Number') {
        return leaf.value
          .split(',')
          .map(string => Number(string.trim()))
          .filter(number => !Number.isNaN(number) && Number.isFinite(number));
      }

      return leaf.value.split(',').map(v => v.trim());
    }

    return leaf.value;
  }

  /** Convert snake_case to PascalCase */
  private static toPascalCase(value: string): Operator {
    const pascalCased =
      value.slice(0, 1).toUpperCase() +
      value.slice(1).replace(/_[a-z]/g, match => match.slice(1).toUpperCase());

    return pascalCased as Operator;
  }

  private static isLeaf(raw: unknown): raw is { field: string; operator: string; value: unknown } {
    return typeof raw === 'object' && 'field' in raw && 'operator' in raw;
  }

  private static isBranch(raw: unknown): raw is { aggregator: string; conditions: unknown[] } {
    return typeof raw === 'object' && 'aggregator' in raw && 'conditions' in raw;
  }
}
