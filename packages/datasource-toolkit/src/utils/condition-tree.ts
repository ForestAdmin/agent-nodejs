import ConditionTree from '../interfaces/query/condition-tree/base';
import ConditionTreeBranch, { Aggregator } from '../interfaces/query/condition-tree/branch';
import ConditionTreeLeaf, { Operator } from '../interfaces/query/condition-tree/leaf';
import { CompositeId, RecordData } from '../interfaces/record';
import { CollectionSchema } from '../interfaces/schema';
import RecordUtils from './record';
import SchemaUtils from './schema';

export default class ConditionTreeUtils {
  static EmptySet = new ConditionTreeBranch(Aggregator.Or, []);

  static matchRecords(schema: CollectionSchema, records: RecordData[]): ConditionTree {
    const ids = records.map(r => RecordUtils.getPrimaryKey(schema, r));

    return ConditionTreeUtils.matchIds(schema, ids);
  }

  static matchIds(schema: CollectionSchema, ids: CompositeId[]): ConditionTree {
    return ConditionTreeUtils.matchFields(SchemaUtils.getPrimaryKeys(schema), ids);
  }

  private static matchFields(fields: string[], values: unknown[][]): ConditionTree {
    if (fields.length === 1) {
      return new ConditionTreeLeaf(
        values.length > 1
          ? { field: fields[0], operator: Operator.In, value: values.map(tuple => tuple[0]) }
          : { field: fields[0], operator: Operator.Equal, value: values[0][0] },
      );
    }

    const [firstField, ...otherFields] = fields;
    const groups = new Map<unknown, unknown[][]>();

    for (const [firstValue, ...otherValues] of values) {
      if (groups.has(firstValue)) groups.get(firstValue).push(otherValues);
      else groups.set(firstValue, [otherValues]);
    }

    return ConditionTreeUtils.union(
      ...[...groups.entries()].map<ConditionTree>(([firstValue, subValues]) =>
        ConditionTreeUtils.intersect(
          ConditionTreeUtils.matchFields([firstField], [[firstValue]]),
          ConditionTreeUtils.matchFields(otherFields, subValues),
        ),
      ),
    );
  }

  static union(...trees: ConditionTree[]): ConditionTree {
    return ConditionTreeUtils.group(Aggregator.Or, trees);
  }

  static intersect(...trees: ConditionTree[]): ConditionTree {
    return ConditionTreeUtils.group(Aggregator.And, trees);
  }

  private static group(aggregator: Aggregator, trees: ConditionTree[]): ConditionTree {
    const conditions = trees
      .filter(Boolean)
      .reduce(
        (currentConditions, tree) =>
          tree instanceof ConditionTreeBranch && tree.aggregator === aggregator
            ? [...currentConditions, ...tree.conditions]
            : [...currentConditions, tree],
        [] as ConditionTree[],
      );

    if (conditions.length === 1) {
      return conditions[0];
    }

    return new ConditionTreeBranch(aggregator, conditions);
  }
}
