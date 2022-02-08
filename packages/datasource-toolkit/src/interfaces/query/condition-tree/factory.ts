import ConditionTree from './base';
import ConditionTreeBranch, { Aggregator, BranchComponents } from './branch';
import ConditionTreeLeaf, { LeafComponents, Operator } from './leaf';
import { CompositeId, RecordData } from '../../record';
import { CollectionSchema } from '../../schema';
import RecordUtils from '../../../utils/record';
import SchemaUtils from '../../../utils/schema';

export default class ConditionTreeFactory {
  static MatchNone = new ConditionTreeBranch(Aggregator.Or, []);
  static MatchAll = new ConditionTreeBranch(Aggregator.And, []);

  static matchRecords(schema: CollectionSchema, records: RecordData[]): ConditionTree {
    const ids = records.map(r => RecordUtils.getPrimaryKey(schema, r));

    return ConditionTreeFactory.matchIds(schema, ids);
  }

  static matchIds(schema: CollectionSchema, ids: CompositeId[]): ConditionTree {
    return ConditionTreeFactory.matchFields(SchemaUtils.getPrimaryKeys(schema), ids);
  }

  static union(...trees: ConditionTree[]): ConditionTree {
    return ConditionTreeFactory.group(Aggregator.Or, trees);
  }

  static intersect(...trees: ConditionTree[]): ConditionTree {
    return ConditionTreeFactory.group(Aggregator.And, trees);
  }

  static fromJson(json: unknown): ConditionTree {
    if (ConditionTreeFactory.isLeaf(json)) {
      return new ConditionTreeLeaf(json.field, json.operator, json.value);
    }

    if (ConditionTreeFactory.isBranch(json)) {
      return new ConditionTreeBranch(
        json.aggregator,
        json.conditions.map(subTree => ConditionTreeFactory.fromJson(subTree)),
      );
    }

    throw new Error('Failed to instanciate condition tree from json');
  }

  private static matchFields(fields: string[], values: unknown[][]): ConditionTree {
    if (values.length === 0) return ConditionTreeFactory.MatchNone;

    if (fields.length === 1) {
      const fieldValues = values.map(tuple => tuple[0]);

      return fieldValues.length > 1
        ? new ConditionTreeLeaf(fields[0], Operator.In, fieldValues)
        : new ConditionTreeLeaf(fields[0], Operator.Equal, fieldValues[0]);
    }

    const [firstField, ...otherFields] = fields;
    const groups = new Map<unknown, unknown[][]>();

    for (const [firstValue, ...otherValues] of values) {
      if (groups.has(firstValue)) groups.get(firstValue).push(otherValues);
      else groups.set(firstValue, [otherValues]);
    }

    return ConditionTreeFactory.union(
      ...[...groups.entries()].map<ConditionTree>(([firstValue, subValues]) =>
        ConditionTreeFactory.intersect(
          ConditionTreeFactory.matchFields([firstField], [[firstValue]]),
          ConditionTreeFactory.matchFields(otherFields, subValues),
        ),
      ),
    );
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

  private static isLeaf(raw: unknown): raw is LeafComponents {
    return typeof raw === 'object' && 'field' in raw && 'operator' in raw;
  }

  private static isBranch(raw: unknown): raw is BranchComponents {
    return typeof raw === 'object' && 'aggregation' in raw && 'conditions' in raw;
  }
}
