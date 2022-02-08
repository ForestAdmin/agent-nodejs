import ConditionTree from '../interfaces/query/condition-tree/base';
import ConditionTreeBranch, {
  Aggregator,
  BranchComponents,
} from '../interfaces/query/condition-tree/branch';
import ConditionTreeLeaf, {
  LeafComponents,
  Operator,
} from '../interfaces/query/condition-tree/leaf';
import { CompositeId, RecordData } from '../interfaces/record';
import { CollectionSchema } from '../interfaces/schema';
import RecordUtils from './record';
import SchemaUtils from './schema';

export default class ConditionTreeUtils {
  static MatchNone = new ConditionTreeBranch(Aggregator.Or, []);
  static MatchAll = new ConditionTreeBranch(Aggregator.And, []);

  static matchRecords(schema: CollectionSchema, records: RecordData[]): ConditionTree {
    const ids = records.map(r => RecordUtils.getPrimaryKey(schema, r));

    return ConditionTreeUtils.matchIds(schema, ids);
  }

  static matchIds(schema: CollectionSchema, ids: CompositeId[]): ConditionTree {
    return ConditionTreeUtils.matchFields(SchemaUtils.getPrimaryKeys(schema), ids);
  }

  private static matchFields(fields: string[], values: unknown[][]): ConditionTree {
    if (values.length === 0) return ConditionTreeUtils.MatchNone;

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

  static fromJson(json: unknown): ConditionTree {
    if (ConditionTreeUtils.isLeaf(json)) {
      return new ConditionTreeLeaf(json.field, json.operator, json.value);
    }

    if (ConditionTreeUtils.isBranch(json)) {
      return new ConditionTreeBranch(
        json.aggregator,
        json.conditions.map(subTree => ConditionTreeUtils.fromJson(subTree)),
      );
    }

    throw new Error('Failed to instanciate condition tree from json');
  }

  private static isLeaf(raw: unknown): raw is LeafComponents {
    return typeof raw === 'object' && 'field' in raw && 'operator' in raw;
  }

  private static isBranch(raw: unknown): raw is BranchComponents {
    return typeof raw === 'object' && 'aggregation' in raw && 'conditions' in raw;
  }
}
