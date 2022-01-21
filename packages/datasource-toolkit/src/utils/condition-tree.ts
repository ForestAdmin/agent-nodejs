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
    ConditionTreeUtils.forEveryLeafs(
      conditionTree,
      collection,
      (currentCondition: ConditionTreeLeaf): void => {
        const fieldSchema = CollectionUtils.getFieldSchema(
          collection,
          currentCondition.field,
        ) as ColumnSchema;

        ConditionTreeUtils.throwErrorIfConditionFieldValueIsNotAllowedWithOperator(
          currentCondition,
          fieldSchema,
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

  private static forEveryLeafs(
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
    columnSchema: ColumnSchema,
  ): void {
    const { value } = conditionTree;
    let valueType = TypeGetterUtil.get(value);
    valueType = ConditionTreeUtils.checkIfItIsAPointOrReturnType(valueType, columnSchema, value);

    const allowedTypes = MAP_ALLOWED_TYPES_FOR_OPERATOR_IN_FILTER[conditionTree.operator];

    const isTypeAllowed = !!allowedTypes.find(type => type === valueType);

    if (!isTypeAllowed) {
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
    type: PrimitiveTypes | NonPrimitiveTypes,
    columnSchema: ColumnSchema,
    value: unknown,
  ) {
    if (
      type === NonPrimitiveTypes.ArrayOfNumber &&
      columnSchema.columnType === PrimitiveTypes.Point
    ) {
      return (value as number[]).length === 2
        ? PrimitiveTypes.Point
        : NonPrimitiveTypes.ArrayOfNumber;
    }

    return type;
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
        `The given operator '${conditionTree.operator}' ` +
          `is not allowed with the columnType schema: '${columnSchema.columnType}'. \n` +
          `The allowed types are/is: [${allowedOperators}]`,
      );
    }
  }

  private static throwErrorIfConditionFieldValueIsNotAllowedWithColumnTypeSchema(
    conditionTree: ConditionTreeLeaf,
    columnSchema: ColumnSchema,
  ): void {
    const { value } = conditionTree;
    const { columnType } = columnSchema;
    const allowedTypes = MAP_ALLOWED_TYPES_IN_FILTER_FOR_COLUMN_TYPE[columnType as PrimitiveTypes];

    let type = TypeGetterUtil.get(value);
    type = ConditionTreeUtils.checkIfItIsAPointOrReturnType(type, columnSchema, value);

    const isValueAllowed = !!allowedTypes.find(allowedType => allowedType === type);

    if (!isValueAllowed) {
      throw new Error(
        `The given value '${JSON.stringify(value)} (type: ${type})' ` +
          `is not allowed with the columnType schema '${columnType}'. \n` +
          `The allowed value(s) are/is [${allowedTypes}].`,
      );
    }

    if (columnSchema.columnType === PrimitiveTypes.Enum) {
      this.throwErrorIfEnumIsNotValid(type, conditionTree, columnSchema);
    }
  }

  private static throwErrorIfEnumIsNotValid(
    type: PrimitiveTypes | NonPrimitiveTypes,
    conditionTree: ConditionTreeLeaf,
    columnSchema: ColumnSchema,
  ) {
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
