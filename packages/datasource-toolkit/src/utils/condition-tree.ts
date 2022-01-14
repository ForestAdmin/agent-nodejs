import {
  Aggregator,
  ConditionTree,
  ConditionTreeBranch,
  ConditionTreeLeaf,
  ConditionTreeNot,
  Operator,
} from '../interfaces/query/selection';

import { Collection } from '../interfaces/collection';
import { PrimitiveTypes, SchemaUtils } from '../index';

export const ConditionTreeNotMatchAnyResult = Object.freeze({
  aggregator: Aggregator.Or,
  conditions: [],
});

export default class ConditionTreeUtils {
  static validate(conditionTree: ConditionTree, collection: Collection): void {
    if (ConditionTreeUtils.isBranch(conditionTree)) {
      conditionTree.conditions.forEach(condition =>
        ConditionTreeUtils.validate(condition, collection),
      );

      return;
    }

    const fieldName = (conditionTree as ConditionTreeLeaf).field;
    ConditionTreeUtils.throwErrorIfFieldNotExistInSchema(fieldName, collection);

    ConditionTreeUtils.throwErrorIfConditionIsNotValid(
      conditionTree as ConditionTreeLeaf,
      fieldName,
    );
  }

  private static throwErrorIfFieldNotExistInSchema(fieldName: string, collection: Collection) {
    const field = SchemaUtils.getField(fieldName, collection.schema);

    if (!field) {
      throw new Error(`field not exist ${fieldName}`);
    }
  }

  private static throwErrorIfConditionIsNotValid(
    conditionTree: ConditionTreeLeaf,
    value?: unknown,
  ): void {
    const map = {
      [Operator.Present]: ['no_value_expected'],
    };

    const valueType = ConditionTreeUtils.getValueType(value);

    const allowedOperators = map[conditionTree.operator];

    if (allowedOperators) {
      const isOperatorExist = !!allowedOperators.find(
        operatorAllowed => operatorAllowed === valueType,
      );

      if (!isOperatorExist) {
        throw new Error(
          `The given condition ${JSON.stringify(conditionTree)} has an error.\n
           The value attribute is an unexpected value for the given operator.\n
          ${
            allowedOperators === ['no_value_expected']
              ? 'The value attribute must be empty for the given operator'
              : `The allowed types for the given operator are: [${allowedOperators}]`
          }`,
        );
      }
    }
  }

  private static getValueType(value): 'no_value' | PrimitiveTypes {
    return PrimitiveTypes.Number;
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
