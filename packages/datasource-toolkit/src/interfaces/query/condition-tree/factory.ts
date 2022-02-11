import { CollectionSchema, ColumnSchema } from '../../schema';
import { CompositeId, RecordData } from '../../record';
import ConditionTree from './nodes/base';
import ConditionTreeBranch, { Aggregator, BranchComponents } from './nodes/branch';
import ConditionTreeLeaf, { LeafComponents, Operator } from './nodes/leaf';
import RecordUtils from '../../../utils/record';
import SchemaUtils from '../../../utils/schema';

export default class ConditionTreeFactory {
  static MatchNone: ConditionTree = new ConditionTreeBranch(Aggregator.Or, []);
  static MatchAll: ConditionTree = null;

  static matchRecords(schema: CollectionSchema, records: RecordData[]): ConditionTree {
    const ids = records.map(r => RecordUtils.getPrimaryKey(schema, r));

    return ConditionTreeFactory.matchIds(schema, ids);
  }

  static matchIds(schema: CollectionSchema, ids: CompositeId[]): ConditionTree {
    const primaryKeyNames = SchemaUtils.getPrimaryKeys(schema);

    if (primaryKeyNames.length === 0) {
      throw new Error('Collection must have at least one primary key');
    }

    for (const name of primaryKeyNames) {
      const operators = (schema.fields[name] as ColumnSchema).filterOperators;

      if (!operators?.has(Operator.Equal) || !operators?.has(Operator.In)) {
        throw new Error(`Field '${name}' must support operators: ['equal', 'in']`);
      }
    }

    return ConditionTreeFactory.matchFields(primaryKeyNames, ids);
  }

  static union(...trees: ConditionTree[]): ConditionTree {
    return ConditionTreeFactory.group(Aggregator.Or, trees);
  }

  static intersect(...trees: ConditionTree[]): ConditionTree {
    const result = ConditionTreeFactory.group(Aggregator.And, trees);
    const isEmptyAnd =
      result instanceof ConditionTreeBranch &&
      result.aggregator === Aggregator.And &&
      result.conditions.length === 0;

    return isEmptyAnd ? null : result;
  }

  static fromPlainObject(json: unknown): ConditionTree {
    if (ConditionTreeFactory.isLeaf(json)) {
      return new ConditionTreeLeaf(json.field, json.operator, json.value);
    }

    if (ConditionTreeFactory.isBranch(json)) {
      const branch = new ConditionTreeBranch(
        json.aggregator,
        json.conditions.map(subTree => ConditionTreeFactory.fromPlainObject(subTree)),
      );

      return branch.conditions.length !== 1 ? branch : branch.conditions[0];
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
    return typeof raw === 'object' && 'aggregator' in raw && 'conditions' in raw;
  }
}
