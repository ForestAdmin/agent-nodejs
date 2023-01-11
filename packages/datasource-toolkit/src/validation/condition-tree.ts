import FieldValidator from './field';
import {
  MAP_ALLOWED_OPERATORS_FOR_COLUMN_TYPE,
  MAP_ALLOWED_TYPES_FOR_COLUMN_TYPE,
  MAP_ALLOWED_TYPES_FOR_OPERATOR_CONDITION_TREE,
} from './rules';
import { ValidationError } from '../errors';
import { Collection } from '../interfaces/collection';
import ConditionTree from '../interfaces/query/condition-tree/nodes/base';
import ConditionTreeBranch from '../interfaces/query/condition-tree/nodes/branch';
import ConditionTreeLeaf from '../interfaces/query/condition-tree/nodes/leaf';
import { ColumnSchema, PrimitiveTypes } from '../interfaces/schema';
import CollectionUtils from '../utils/collection';

export default class ConditionTreeValidator {
  static validate(conditionTree: ConditionTree, collection: Collection): void {
    if (conditionTree instanceof ConditionTreeBranch) {
      ConditionTreeValidator.validateBranch(conditionTree, collection);
    } else if (conditionTree instanceof ConditionTreeLeaf) {
      ConditionTreeValidator.validateLeaf(conditionTree, collection);
    } else {
      throw new ValidationError('Unexpected condition tree type');
    }
  }

  private static validateBranch(branch: ConditionTreeBranch, collection: Collection): void {
    if (!['And', 'Or'].includes(branch.aggregator)) {
      throw new ValidationError(
        `The given aggregator '${branch.aggregator}' ` +
          `is not supported. The supported values are: ['Or', 'And']`,
      );
    }

    if (!Array.isArray(branch.conditions)) {
      throw new ValidationError(
        `The given conditions '${branch.conditions}' were expected to be an array`,
      );
    }

    for (const condition of branch.conditions) {
      ConditionTreeValidator.validate(condition, collection);
    }
  }

  private static validateLeaf(leaf: ConditionTreeLeaf, collection: Collection): void {
    const fieldSchema = CollectionUtils.getFieldSchema(collection, leaf.field) as ColumnSchema;

    ConditionTreeValidator.throwIfOperatorNotAllowedWithColumn(leaf, fieldSchema);
    ConditionTreeValidator.throwIfValueNotAllowedWithOperator(leaf, fieldSchema);
    ConditionTreeValidator.throwIfOperatorNotAllowedWithColumnType(leaf, fieldSchema);
    ConditionTreeValidator.throwIfValueNotAllowedWithColumnType(leaf, fieldSchema);
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
    const { value, field } = conditionTree;
    const allowedTypes = MAP_ALLOWED_TYPES_FOR_OPERATOR_CONDITION_TREE[conditionTree.operator];
    this.validateValues(field, columnSchema, value, allowedTypes);
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
    const { value, field, operator } = conditionTree;

    // exclude some cases where the value is not related to the columnType of the field
    if (
      operator !== 'ShorterThan' &&
      operator !== 'LongerThan' &&
      operator !== 'AfterXHoursAgo' &&
      operator !== 'BeforeXHoursAgo' &&
      operator !== 'PreviousXDays' &&
      operator !== 'PreviousXDaysToDate'
    ) {
      const types = MAP_ALLOWED_TYPES_FOR_COLUMN_TYPE[columnSchema.columnType as PrimitiveTypes];
      this.validateValues(field, columnSchema, value, types);
    }
  }

  private static validateValues(
    field: string,
    columnSchema: ColumnSchema,
    value: unknown,
    allowedTypes: readonly PrimitiveTypes[],
  ): void {
    if (Array.isArray(value)) {
      (value as Array<unknown>).forEach(itemValue =>
        FieldValidator.validateValue(field, columnSchema, itemValue, allowedTypes),
      );
    } else {
      FieldValidator.validateValue(field, columnSchema, value, allowedTypes);
    }
  }
}
