import {
  Aggregator,
  ConditionTree,
  ConditionTreeBranch,
  ConditionTreeLeaf,
} from '../interfaces/query/selection';

import { Collection } from '../interfaces/collection';
import { SchemaUtils } from '../index';

export const ConditionTreeNotMatchAnyResult = Object.freeze({
  aggregator: Aggregator.Or,
  conditions: [],
});

export default class ConditionTreeUtils {
  static validate(conditionTree: ConditionTree, collection: Collection) {
    if (ConditionTreeUtils.isBranch(conditionTree)) {
      if (conditionTree.conditions.length > 0) {
        return ConditionTreeUtils.validate(conditionTree.conditions[0], collection);
      }

      return false;
    }

    return !!SchemaUtils.getField((conditionTree as ConditionTreeLeaf).field, collection.schema);
  }

  static intersect(...conditionTrees: ConditionTree[]): ConditionTree {
    const conditions = conditionTrees.reduce((currentConditions, condition) => {
      if (!condition) return currentConditions;

      return ConditionTreeUtils.isBranch(condition) && condition.aggregator === Aggregator.And
        ? [...currentConditions, ...condition.conditions]
        : [...currentConditions, condition];
    }, []);

    if (conditions.length === 1) {
      return conditions[0];
    }

    return { aggregator: Aggregator.And, conditions };
  }

  static isBranch(conditionTree: ConditionTree): conditionTree is ConditionTreeBranch {
    return (conditionTree as ConditionTreeBranch).aggregator !== undefined;
  }

  static replaceLeafs(
    tree: ConditionTree,
    handler: (leaf: ConditionTreeLeaf) => ConditionTree,
    bind: unknown = null,
  ): ConditionTree {
    if (!tree) {
      return null;
    }

    if (ConditionTreeUtils.isBranch(tree)) {
      return {
        ...tree,
        conditions: tree.conditions.map((c: ConditionTree) =>
          ConditionTreeUtils.replaceLeafs(c, handler, bind),
        ),
      };
    }

    return handler.call(bind, tree);
  }
}
