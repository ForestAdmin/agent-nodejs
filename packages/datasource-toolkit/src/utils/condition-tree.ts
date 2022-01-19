import {
  Aggregator,
  ConditionTree,
  ConditionTreeBranch,
  ConditionTreeLeaf,
  Operator,
} from '../interfaces/query/selection';

import { Collection } from '../interfaces/collection';
import { ColumnSchema, NonPrimitiveTypes, PrimitiveTypes } from '../interfaces/schema';
import TypeGetterUtil from './type-checker';
import CollectionUtils from './collection';

export const ConditionTreeNotMatchAnyResult = Object.freeze({
  aggregator: Aggregator.Or,
  conditions: [],
});

const NO_TYPES_ALLOWED: Readonly<PrimitiveTypes[]> = [];

export const MAP_OPERATOR_TYPES: Readonly<{
  [operator: string]: readonly (PrimitiveTypes | NonPrimitiveTypes)[];
}> = Object.freeze({
  [Operator.Present]: NO_TYPES_ALLOWED,
  [Operator.Blank]: NO_TYPES_ALLOWED,
  [Operator.In]: [
    NonPrimitiveTypes.ArrayOfNumber,
    NonPrimitiveTypes.ArrayOfString,
    NonPrimitiveTypes.ArrayOfBoolean,
    NonPrimitiveTypes.EmptyArray,
  ],
  [Operator.Equal]: [PrimitiveTypes.String, PrimitiveTypes.Number, PrimitiveTypes.Uuid],
  [Operator.Contains]: [PrimitiveTypes.String],
  [Operator.GreaterThan]: [PrimitiveTypes.Number],
  [Operator.EndsWith]: [],
  [Operator.IncludesAll]: [],
  [Operator.LessThan]: [],
  [Operator.NotContains]: [],
  [Operator.NotEqual]: [],
  [Operator.NotIn]: [],
  [Operator.StartsWith]: [],
  [Operator.AfterXHoursAgo]: [],
  [Operator.BeforeXHoursAgo]: [],
  [Operator.Future]: [],
  [Operator.Past]: [],
  [Operator.PreviousMonth]: [],
  [Operator.PreviousMonthToDate]: [],
  [Operator.PreviousQuarter]: [],
  [Operator.PreviousQuarterToDate]: [],
  [Operator.PreviousYear]: [],
  [Operator.PreviousYearToDate]: [],
  [Operator.PreviousWeek]: [],
  [Operator.PreviousWeekToDate]: [],
  [Operator.PreviousXDays]: [],
  [Operator.PreviousXDaysToDate]: [],
  [Operator.Today]: [],
  [Operator.Yesterday]: [],
  [Operator.LessThan]: [],
  [Operator.LongerThan]: [],
  [Operator.ShorterThan]: [],
  [Operator.Like]: [],
});

export const MAP_COLUMN_TYPE_SCHEMA_OPERATORS: Readonly<{
  [type: string]: readonly Operator[];
}> = Object.freeze({
  [PrimitiveTypes.String]: [Operator.Present, Operator.Equal, Operator.In],
  [PrimitiveTypes.Number]: [Operator.Present, Operator.Equal, Operator.GreaterThan, Operator.In],
  [PrimitiveTypes.Boolean]: [],
  [PrimitiveTypes.Date]: [],
  [PrimitiveTypes.Dateonly]: [],
  [PrimitiveTypes.Enum]: [],
  [PrimitiveTypes.Json]: [],
  [PrimitiveTypes.Point]: [],
  [PrimitiveTypes.Timeonly]: [],
  [PrimitiveTypes.Uuid]: [Operator.Equal],
});

export const MAP_COLUMN_TYPE_SCHEMA_VALUE_TYPE: Readonly<{
  [type: string]: readonly (PrimitiveTypes | NonPrimitiveTypes)[];
}> = Object.freeze({
  [PrimitiveTypes.String]: [PrimitiveTypes.String, NonPrimitiveTypes.ArrayOfString],
  [PrimitiveTypes.Number]: [PrimitiveTypes.Number, NonPrimitiveTypes.ArrayOfNumber],
  [PrimitiveTypes.Boolean]: [PrimitiveTypes.Boolean, NonPrimitiveTypes.ArrayOfBoolean],
  [PrimitiveTypes.Date]: [],
  [PrimitiveTypes.Dateonly]: [],
  [PrimitiveTypes.Enum]: [],
  [PrimitiveTypes.Json]: [],
  [PrimitiveTypes.Point]: [],
  [PrimitiveTypes.Timeonly]: [],
  [PrimitiveTypes.Uuid]: [PrimitiveTypes.Uuid],
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

    const allowedTypes = MAP_OPERATOR_TYPES[conditionTree.operator];

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
      MAP_COLUMN_TYPE_SCHEMA_OPERATORS[columnSchema.columnType as PrimitiveTypes];

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
      MAP_COLUMN_TYPE_SCHEMA_VALUE_TYPE[columnSchema.columnType as PrimitiveTypes];

    const isValueAllowed = !!allowedTypes.find(
      allowedType => allowedType === TypeGetterUtil.get(conditionTree.value),
    );

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
