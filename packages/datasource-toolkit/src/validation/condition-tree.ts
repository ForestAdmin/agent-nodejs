import { Collection } from '../interfaces/collection';
import { ColumnSchema, PrimitiveTypes } from '../interfaces/schema';
import {
  MAP_ALLOWED_OPERATORS_FOR_COLUMN_TYPE,
  MAP_ALLOWED_TYPES_FOR_COLUMN_TYPE,
  MAP_ALLOWED_TYPES_FOR_OPERATOR,
} from './rules';
import CollectionUtils from '../utils/collection';
import ConditionTree from '../interfaces/query/condition-tree/nodes/base';
import ConditionTreeLeaf from '../interfaces/query/condition-tree/nodes/leaf';
import FieldValidator from './field';
import TypeGetter from './type-getter';
import ValidationError from '../errors';

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
      throw new ValidationError(
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
    const valueType = TypeGetter.get(value, columnSchema.columnType as PrimitiveTypes);

    const allowedTypes = MAP_ALLOWED_TYPES_FOR_OPERATOR[conditionTree.operator];

    if (!allowedTypes.includes(valueType)) {
      throw new ValidationError(
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
      MAP_ALLOWED_OPERATORS_FOR_COLUMN_TYPE[columnSchema.columnType as PrimitiveTypes];

    if (!allowedOperators.includes(conditionTree.operator)) {
      throw new ValidationError(
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
    const { value, field } = conditionTree;
    const { columnType } = columnSchema;
    const allowedTypes = MAP_ALLOWED_TYPES_FOR_COLUMN_TYPE[columnType as PrimitiveTypes];

    FieldValidator.validateValue(field, columnSchema, value, allowedTypes);
  }
}
