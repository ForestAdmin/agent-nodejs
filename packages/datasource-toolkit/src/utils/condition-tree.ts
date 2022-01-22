import {
  Aggregator,
  ConditionTree,
  ConditionTreeBranch,
  ConditionTreeLeaf,
} from '../interfaces/query/selection';

import { Collection } from '../interfaces/collection';
import { ColumnSchema, PrimitiveTypes } from '../interfaces/schema';
import TypeGetterUtil from './type-checker';
import CollectionUtils from './collection';
import {
  MAP_ALLOWED_OPERATORS_IN_FILTER_FOR_COLUMN_TYPE,
  MAP_ALLOWED_TYPES_FOR_OPERATOR_IN_FILTER,
  MAP_ALLOWED_TYPES_IN_FILTER_FOR_COLUMN_TYPE,
} from './rules';
import ValidationTypes from '../interfaces/validation';

export const CONDITION_TREE_NOT_MATCH_ANY_RESULT = Object.freeze({
  aggregator: Aggregator.Or,
  conditions: [],
});

export default class ConditionTreeUtils {
  static validate(conditionTree: ConditionTree, collection: Collection): void {
    ConditionTreeUtils.forEachLeaf(
      conditionTree,
      collection,
      (currentCondition: ConditionTreeLeaf): void => {
        const fieldSchema = CollectionUtils.getFieldSchema(
          collection,
          currentCondition.field,
        ) as ColumnSchema;

        ConditionTreeUtils.throwIfValueNotAllowedWithOperator(currentCondition, fieldSchema);
        ConditionTreeUtils.throwIfOperatorNotAllowedWithColumnType(currentCondition, fieldSchema);
        ConditionTreeUtils.throwIfValueNotAllowedWithColumnType(currentCondition, fieldSchema);
      },
    );
  }

  private static forEachLeaf(
    conditionTree: ConditionTree,
    collection: Collection,
    forCurrentLeafFn: (conditionTree: ConditionTreeLeaf) => void,
  ): void {
    if (ConditionTreeUtils.isBranch(conditionTree)) {
      return conditionTree.conditions.forEach(condition =>
        ConditionTreeUtils.validate(condition, collection),
      );
    }

    return forCurrentLeafFn(conditionTree as ConditionTreeLeaf);
  }

  private static throwIfValueNotAllowedWithOperator(
    conditionTree: ConditionTreeLeaf,
    columnSchema: ColumnSchema,
  ): void {
    const { value } = conditionTree;
    let valueType = TypeGetterUtil.get(value);
    valueType = ConditionTreeUtils.checkIfItIsAPointOrReturnType(valueType, columnSchema, value);

    const allowedTypes = MAP_ALLOWED_TYPES_FOR_OPERATOR_IN_FILTER[conditionTree.operator];

    if (!allowedTypes.includes(valueType)) {
      throw new Error(
        `The given value attribute '${JSON.stringify(
          value,
        )} (type: ${valueType})' has an unexpected value ` +
          `for the given operator '${conditionTree.operator}'.\n ` +
          `${
            allowedTypes.length === 0
              ? 'The value attribute must be empty.'
              : `The allowed field value types are: [${allowedTypes}].`
          }`,
      );
    }
  }

  private static checkIfItIsAPointOrReturnType(
    type: PrimitiveTypes | ValidationTypes,
    columnSchema: ColumnSchema,
    value: unknown,
  ) {
    if (
      type === ValidationTypes.ArrayOfNumber &&
      columnSchema.columnType === PrimitiveTypes.Point
    ) {
      if ((value as number[]).length !== 2) {
        throw new Error(
          `The given Point value '${JSON.stringify(
            value,
          )}' is badly formatted. The format is: [x,y].`,
        );
      }

      return PrimitiveTypes.Point;
    }

    return type;
  }

  private static throwIfOperatorNotAllowedWithColumnType(
    conditionTree: ConditionTreeLeaf,
    columnSchema: ColumnSchema,
  ): void {
    const allowedOperators =
      MAP_ALLOWED_OPERATORS_IN_FILTER_FOR_COLUMN_TYPE[columnSchema.columnType as PrimitiveTypes];

    if (!allowedOperators.includes(conditionTree.operator)) {
      throw new Error(
        `The given operator '${conditionTree.operator}' ` +
          `is not allowed with the columnType schema: '${columnSchema.columnType}'. \n` +
          `The allowed types are/is: [${allowedOperators}]`,
      );
    }
  }

  private static throwIfValueNotAllowedWithColumnType(
    conditionTree: ConditionTreeLeaf,
    columnSchema: ColumnSchema,
  ): void {
    const { value } = conditionTree;
    const { columnType } = columnSchema;
    const allowedTypes = MAP_ALLOWED_TYPES_IN_FILTER_FOR_COLUMN_TYPE[columnType as PrimitiveTypes];

    let type = TypeGetterUtil.get(value);
    type = ConditionTreeUtils.checkIfItIsAPointOrReturnType(type, columnSchema, value);

    if (!allowedTypes.includes(type)) {
      throw new Error(
        `The given value '${JSON.stringify(value)} (type: ${type})' ` +
          `is not allowed with the columnType schema '${columnType}'. \n` +
          `The allowed value(s) are/is [${allowedTypes}].`,
      );
    }

    if (columnSchema.columnType === PrimitiveTypes.Enum) {
      this.throwIfInvalidEnumValue(type, conditionTree, columnSchema);
    }
  }

  private static throwIfInvalidEnumValue(
    type: PrimitiveTypes | ValidationTypes,
    conditionTree: ConditionTreeLeaf,
    columnSchema: ColumnSchema,
  ) {
    let isEnumAllowed;

    if (type === ValidationTypes.ArrayOfString) {
      const enumValuesConditionTree = conditionTree.value as Array<string>;
      isEnumAllowed = enumValuesConditionTree.every(value =>
        columnSchema.enumValues.includes(value),
      );
    } else {
      isEnumAllowed = columnSchema.enumValues.includes(conditionTree.value as string);
    }

    if (!isEnumAllowed) {
      throw new Error(
        `The given enum value(s) [${conditionTree.value}] is not listed in ` +
          `[${columnSchema.enumValues}]`,
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
