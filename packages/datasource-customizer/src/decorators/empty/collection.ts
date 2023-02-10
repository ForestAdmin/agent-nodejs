import {
  AggregateResult,
  Aggregation,
  Caller,
  ConditionTree,
  ConditionTreeBranch,
  ConditionTreeLeaf,
  Filter,
  Projection,
  RecordData,
} from '@forestadmin/datasource-toolkit';

import CollectionDecorator from '../collection-decorator';

/**
 * Avoid performing useless database requests:
 * Using segments + scopes + filters + jointure emulation often yields requests which have
 * mutually exclusive conditions or empty "In" leafs.
 */
export default class EmptyCollectionDecorator extends CollectionDecorator {
  override async list(
    caller: Caller,
    filter: Filter,
    projection: Projection,
  ): Promise<RecordData[]> {
    if (!this.returnsEmptySet(filter.conditionTree)) {
      return super.list(caller, filter, projection);
    }

    return [];
  }

  override async update(caller: Caller, filter: Filter, patch: RecordData): Promise<void> {
    if (!this.returnsEmptySet(filter.conditionTree)) {
      return super.update(caller, filter, patch);
    }
  }

  override async delete(caller: Caller, filter: Filter): Promise<void> {
    if (!this.returnsEmptySet(filter.conditionTree)) {
      return super.delete(caller, filter);
    }
  }

  override async aggregate(
    caller: Caller,
    filter: Filter,
    aggregation: Aggregation,
    limit?: number,
  ): Promise<AggregateResult[]> {
    if (!this.returnsEmptySet(filter.conditionTree)) {
      return super.aggregate(caller, filter, aggregation, limit);
    }

    return [];
  }

  private returnsEmptySet(tree: ConditionTree): boolean {
    if (tree instanceof ConditionTreeLeaf) {
      return this.leafReturnsEmptySet(tree);
    }

    if (tree instanceof ConditionTreeBranch && tree.aggregator === 'Or') {
      return this.orReturnsEmptySet(tree.conditions);
    }

    if (tree instanceof ConditionTreeBranch && tree.aggregator === 'And') {
      return this.andReturnsEmptySet(tree.conditions);
    }

    return false;
  }

  private leafReturnsEmptySet(leaf: ConditionTreeLeaf): boolean {
    // Empty 'in` always return zero records.
    return leaf.operator === 'In' && (leaf.value as unknown[]).length === 0;
  }

  private orReturnsEmptySet(conditions: ConditionTree[]): boolean {
    // Or return no records when
    // - they have no conditions
    // - they have only conditions which return zero records.
    return conditions.length === 0 || conditions.every(c => this.returnsEmptySet(c));
  }

  private andReturnsEmptySet(conditions: ConditionTree[]): boolean {
    // There is a leaf which returns zero records
    if (conditions.some(c => this.returnsEmptySet(c))) {
      return true;
    }

    // Scans for mutually exclusive conditions
    // (this a naive implementation, it will miss many occurences)
    const valuesByField: Record<string, unknown[]> = {};
    const leafs = conditions.filter(
      condition => condition instanceof ConditionTreeLeaf,
    ) as ConditionTreeLeaf[];

    for (const { field, operator, value } of leafs) {
      if (!valuesByField[field] && operator === 'Equal') {
        valuesByField[field] = [value];
      } else if (!valuesByField[field] && operator === 'In') {
        valuesByField[field] = value as unknown[];
      } else if (valuesByField[field] && operator === 'Equal') {
        valuesByField[field] = valuesByField[field].includes(value) ? [value] : [];
      } else if (valuesByField[field] && operator === 'In') {
        valuesByField[field] = valuesByField[field].filter(v => (value as unknown[]).includes(v));
      }
    }

    return Object.values(valuesByField).some(v => v.length === 0);
  }
}
