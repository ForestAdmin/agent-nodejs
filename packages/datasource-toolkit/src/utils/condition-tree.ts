import {
  Aggregator,
  ConditionTree,
  ConditionTreeBranch,
  ConditionTreeLeaf,
  Operator,
} from '../interfaces/query/selection';

import { Collection } from '../interfaces/collection';
import { CollectionSchema, PrimitiveTypes, SchemaUtils } from '../index';
import TypeCheckerUtil from './type-checker';

export const ConditionTreeNotMatchAnyResult = Object.freeze({
  aggregator: Aggregator.Or,
  conditions: [],
});

const MAP_OPERATOR_TYPES = Object.freeze({
  [Operator.Present]: [],
  [Operator.Equal]: [PrimitiveTypes.String, PrimitiveTypes.Number, PrimitiveTypes.Uuid],
});

export default class ConditionTreeUtils {
  static validate(conditionTree: ConditionTree, collection: Collection): void {
    ConditionTreeUtils.forEveryLeafs(
      conditionTree,
      collection,
      (currentCondition: ConditionTreeLeaf): void => {
        const fieldName = currentCondition.field;
        ConditionTreeUtils.throwErrorIfFieldNotExistInSchema(collection.schema, fieldName);
        ConditionTreeUtils.throwErrorIfConditionIsNotValid(currentCondition, fieldName);
      },
    );
  }

  private static forEveryLeafs(
    conditionTree: ConditionTree,
    collection: Collection,
    forCurrentLeaf: (conditionTree: ConditionTreeLeaf) => unknown,
  ): unknown {
    if (ConditionTreeUtils.isBranch(conditionTree)) {
      return conditionTree.conditions.forEach(condition =>
        ConditionTreeUtils.validate(condition, collection),
      );
    }

    return forCurrentLeaf(conditionTree as ConditionTreeLeaf);
  }

  private static throwErrorIfFieldNotExistInSchema(schema: CollectionSchema, fieldName: string) {
    const field = SchemaUtils.getField(fieldName, schema);

    if (!field) {
      throw new Error(`field not exist ${fieldName}`);
    }
  }

  private static throwErrorIfConditionIsNotValid(
    conditionTree: ConditionTreeLeaf,
    value?: unknown,
  ): void {
    const valueType = TypeCheckerUtil.check(value);

    const allowedOperators = MAP_OPERATOR_TYPES[conditionTree.operator];

    const isOperatorExist = !!allowedOperators.find(
      operatorAllowed => operatorAllowed === valueType,
    );

    if (!isOperatorExist) {
      throw new Error(
        `The given condition ${JSON.stringify(conditionTree)} has an error.\n
           The value attribute is an unexpected value for the given operator.\n
          ${
            allowedOperators.length
              ? 'The value attribute must be empty for the given operator'
              : `The allowed types for the given operator are: [${allowedOperators}]`
          }`,
      );
    }
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
