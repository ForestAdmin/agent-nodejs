import { Operator } from './nodes/operators';

export default class ConditionTreeBase {
  /** Convert snake_case to PascalCase */
  protected static toPascalCase(value: string): Operator {
    const pascalCased =
      value.slice(0, 1).toUpperCase() +
      value.slice(1).replace(/_[a-z]/g, match => match.slice(1).toUpperCase());

    return pascalCased as Operator;
  }

  protected static isLeaf(
    raw: unknown,
  ): raw is { field: string; operator: string; value: unknown } {
    return typeof raw === 'object' && 'field' in raw && 'operator' in raw;
  }

  protected static isBranch(raw: unknown): raw is { aggregator: string; conditions: unknown[] } {
    return typeof raw === 'object' && 'aggregator' in raw && 'conditions' in raw;
  }
}
