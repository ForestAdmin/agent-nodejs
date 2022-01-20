import {
  Aggregator,
  ConditionTree,
  ConditionTreeBranch,
  ConditionTreeLeaf,
} from '../interfaces/query/selection';

import { Collection } from '../interfaces/collection';
import { ColumnSchema, NonPrimitiveTypes, PrimitiveTypes } from '../interfaces/schema';
import TypeGetterUtil from './type-checker';
import CollectionUtils from './collection';
import {
  MAP_ALLOWED_OPERATORS_IN_FILTER_FOR_COLUMN_TYPE,
  MAP_ALLOWED_TYPES_FOR_OPERATOR_IN_FILTER,
  MAP_ALLOWED_TYPES_IN_FILTER_FOR_COLUMN_TYPE,
} from './rules';

export const CONDITION_TREE_NOT_MATCH_ANY_RESULT = Object.freeze({
  aggregator: Aggregator.Or,
  conditions: [],
});

export default class ConditionTreeUtils {
  static validate(conditionTree: ConditionTree, collection: Collection): void {
    ConditionTreeUtils.forEveryLeaf(
      conditionTree,
      collection,
      (currentCondition: ConditionTreeLeaf): void => {
        const fieldSchema = CollectionUtils.getFieldSchema(
          collection,
          currentCondition.field,
        ) as ColumnSchema;

        const fieldValue = currentCondition.value;
        ConditionTreeUtils.throwErrorIfConditionFieldValueIsNotAllowedWithOperator(
          currentCondition,
          fieldValue,
        );

        ConditionTreeUtils.throwErrorIfConditionOperatorIsNotAllowedWithColumnTypeSchema(
          currentCondition,
          fieldSchema,
        );
        ConditionTreeUtils.throwErrorIfConditionFieldValueIsNotAllowedWithColumnTypeSchema(
          currentCondition,
          fieldSchema,
        );
      },
    );
  }

  private static forEveryLeaf(
    conditionTree: ConditionTree,
    collection: Collection,
    forCurrentLeafFn: (conditionTree: ConditionTreeLeaf) => unknown,
  ): unknown {
    if (ConditionTreeUtils.isBranch(conditionTree)) {
      return conditionTree.conditions.forEach(condition =>
        ConditionTreeUtils.validate(condition, collection),
      );
    }

    return forCurrentLeafFn(conditionTree as ConditionTreeLeaf);
  }

  private static throwErrorIfConditionFieldValueIsNotAllowedWithOperator(
    conditionTree: ConditionTreeLeaf,
    value?: unknown,
  ): void {
    const valueType = TypeGetterUtil.get(value);

    const allowedTypes = MAP_ALLOWED_TYPES_FOR_OPERATOR_IN_FILTER[conditionTree.operator];

    const isTypeAllowed = !!allowedTypes.find(type => type === valueType);

    if (!isTypeAllowed) {
      throw new Error(
        `The given condition of ${JSON.stringify(
          conditionTree,
        )} has an error.\n The value attribute has an unexpected value for the given operator.\n ${
          allowedTypes.length === 0
            ? 'The value attribute must be empty for the given operator.'
            : `The allowed field value types are: [${allowedTypes}] and the type is '${valueType}'.`
        }`,
      );
    }
  }

  private static throwErrorIfConditionOperatorIsNotAllowedWithColumnTypeSchema(
    conditionTree: ConditionTreeLeaf,
    columnSchema: ColumnSchema,
  ): void {
    const allowedOperators =
      MAP_ALLOWED_OPERATORS_IN_FILTER_FOR_COLUMN_TYPE[columnSchema.columnType as PrimitiveTypes];

    const isOperatorAllowed = !!allowedOperators.find(
      allowedOperator => allowedOperator === conditionTree.operator,
    );

    if (!isOperatorAllowed) {
      throw new Error(
        `The given operator of ${JSON.stringify(conditionTree)} has an error.
 The operator is not allowed with the column type schema: ${JSON.stringify(columnSchema)}
 The allowed types for the given operator are: [${allowedOperators}] and the operator is '${
          conditionTree.operator
        }'`,
      );
    }
  }

  private static throwErrorIfConditionFieldValueIsNotAllowedWithColumnTypeSchema(
    conditionTree: ConditionTreeLeaf,
    columnSchema: ColumnSchema,
  ): void {
    const allowedTypes =
      MAP_ALLOWED_TYPES_IN_FILTER_FOR_COLUMN_TYPE[columnSchema.columnType as PrimitiveTypes];

    const type = TypeGetterUtil.get(conditionTree.value);
    const isValueAllowed = !!allowedTypes.find(allowedType => allowedType === type);

    if (isValueAllowed && columnSchema.columnType === PrimitiveTypes.Enum) {
      let isEnumAllowed;

      if (type === NonPrimitiveTypes.ArrayOfString) {
        const enumValuesConditionTree = conditionTree.value as Array<string>;
        isEnumAllowed = !!columnSchema.enumValues.find(
          value => !!enumValuesConditionTree.every(enumValue => enumValue === value),
        );
      } else {
        isEnumAllowed = !!columnSchema.enumValues.find(value => conditionTree.value === value);
      }

      if (!isEnumAllowed) {
        throw new Error(`Error enum value [${conditionTree.value}]`);
      }
    }

    if (!isValueAllowed) {
      throw new Error(
        `The given value of ${JSON.stringify(conditionTree)} has an error.
 The value is not allowed with the column type schema: ${JSON.stringify(columnSchema)}
 The allowed values for the column type are: [${allowedTypes}]`,
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
