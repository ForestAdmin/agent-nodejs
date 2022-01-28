import { Collection } from '../interfaces/collection';
import ConditionTree from '../interfaces/query/condition-tree/base';
import ConditionTreeLeaf from '../interfaces/query/condition-tree/leaf';
import { ColumnSchema, PrimitiveTypes } from '../interfaces/schema';
import CollectionUtils from '../utils/collection';
import {
  MAP_ALLOWED_OPERATORS_IN_FILTER_FOR_COLUMN_TYPE,
  MAP_ALLOWED_TYPES_FOR_OPERATOR_IN_FILTER,
  MAP_ALLOWED_TYPES_IN_FILTER_FOR_COLUMN_TYPE,
} from './rules';
import TypeGetterUtil from './type-checker';
import ValidationTypes from './types';

export default class ConditionTreeValidator {
  static validate(conditionTree: ConditionTree, collection: Collection): void {
    return conditionTree.forEachLeaf((currentCondition: ConditionTreeLeaf): void => {
      const fieldSchema = CollectionUtils.getFieldSchema(
        collection,
        currentCondition.field,
      ) as ColumnSchema;

      ConditionTreeValidator.throwIfOperatorNotAllowedWithColumn(currentCondition, fieldSchema);
      ConditionTreeValidator.throwIfValueNotAllowedWithOperator(currentCondition, fieldSchema);
      ConditionTreeValidator.throwIfOperatorNotAllowedWithColumnType(currentCondition, fieldSchema);
      ConditionTreeValidator.throwIfValueNotAllowedWithColumnType(currentCondition, fieldSchema);
    });
  }

  private static throwIfOperatorNotAllowedWithColumn(
    conditionTree: ConditionTreeLeaf,
    columnSchema: ColumnSchema,
  ): void {
    const operators = columnSchema.filterOperators;

    if (!operators?.has(conditionTree.operator)) {
      throw new Error(
        `The given operator '${conditionTree.operator}' ` +
          `is not supported by the column: '${conditionTree.field}'.\n${
            operators?.size
              ? `The allowed types are: [${[...operators]}]`
              : 'the column is not filterable'
          }`,
      );
    }
  }

  private static throwIfValueNotAllowedWithOperator(
    conditionTree: ConditionTreeLeaf,
    columnSchema: ColumnSchema,
  ): void {
    const { value } = conditionTree;
    const valueType = TypeGetterUtil.get(value, columnSchema.columnType as PrimitiveTypes);

    const allowedTypes = MAP_ALLOWED_TYPES_FOR_OPERATOR_IN_FILTER[conditionTree.operator];

    if (!allowedTypes.includes(valueType)) {
      throw new Error(
        `The given value attribute '${JSON.stringify(
          value,
        )} (type: ${valueType})' has an unexpected value ` +
          `for the given operator '${conditionTree.operator}'.\n` +
          `${
            allowedTypes.length === 0
              ? 'The value attribute must be empty.'
              : `The allowed types of the field value are: [${allowedTypes}].`
          }`,
      );
    }
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
          `is not allowed with the columnType schema: '${columnSchema.columnType}'.\n` +
          `The allowed types are: [${allowedOperators}]`,
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

    const type = TypeGetterUtil.get(value, columnType as PrimitiveTypes);

    if (!allowedTypes.includes(type)) {
      throw new Error(
        `The given value '${JSON.stringify(value)} (type: ${type})' ` +
          `is not allowed with the columnType schema '${columnType}'.\n` +
          `The allowed values are [${allowedTypes}].`,
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
    let isEnumAllowed: boolean;

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
}
