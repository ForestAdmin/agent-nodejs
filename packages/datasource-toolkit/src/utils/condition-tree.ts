import {
  Aggregator,
  ConditionTree,
  ConditionTreeBranch,
  ConditionTreeLeaf,
  Operator,
} from '../interfaces/query/selection';

import { Collection } from '../interfaces/collection';
import { CollectionSchema, ColumnSchema, PrimitiveTypes, SchemaUtils } from '../index';
import TypeGetterUtil from './type-checker';

export const ConditionTreeNotMatchAnyResult = Object.freeze({
  aggregator: Aggregator.Or,
  conditions: [],
});

export const MAP_OPERATOR_TYPES: Readonly<{ [operator: string]: PrimitiveTypes[] }> = Object.freeze(
  {
    [Operator.Present]: [],
    [Operator.Blank]: [],
    [Operator.In]: [],
    [Operator.Equal]: [PrimitiveTypes.String, PrimitiveTypes.Number, PrimitiveTypes.Uuid],
    [Operator.Contains]: [PrimitiveTypes.String],
    [Operator.GreaterThan]: [PrimitiveTypes.Number],
  },
);

export const MAP_COLUMN_TYPE_SCHEMA_OPERATORS: Readonly<{ [type: string]: Operator[] }> =
  Object.freeze({
    [PrimitiveTypes.String]: [Operator.Present, Operator.Equal],
    [PrimitiveTypes.Number]: [Operator.Present, Operator.Equal, Operator.GreaterThan],
  });

export default class ConditionTreeUtils {
  static validate(conditionTree: ConditionTree, collection: Collection): void {
    ConditionTreeUtils.forEveryLeaf(
      conditionTree,
      collection,
      (currentCondition: ConditionTreeLeaf): void => {
        const fieldName = currentCondition.field;
        const fieldValue = currentCondition.value;
        ConditionTreeUtils.throwErrorIfFieldNotExistInSchema(collection.schema, fieldName);
        ConditionTreeUtils.throwErrorIfConditionFieldValueIsNotAllowedWithOperator(
          currentCondition,
          fieldValue,
        );
        ConditionTreeUtils.throwErrorIfConditionOperatorIsNotAllowedWithColumnTypeSchema(
          currentCondition,
          collection.schema,
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

  private static throwErrorIfFieldNotExistInSchema(schema: CollectionSchema, fieldName: string) {
    const field = SchemaUtils.getField(fieldName, schema);

    if (!field) {
      throw new Error(`field not exist ${fieldName}`);
    }
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
        `The given condition ${JSON.stringify(conditionTree)} has an error.\n
           The value attribute has an unexpected value for the given operator.\n
          ${
            allowedTypes.length === 0
              ? 'The value attribute must be empty for the given operator.'
              : `The allowed field value types for the given operator are: [${allowedTypes}].`
          }`,
      );
    }
  }

  private static throwErrorIfConditionOperatorIsNotAllowedWithColumnTypeSchema(
    conditionTree: ConditionTreeLeaf,
    schema: CollectionSchema,
  ): void {
    const fieldSchema = SchemaUtils.getField(conditionTree.field, schema);

    // TODO: fix
    const allowedOperators =
      MAP_COLUMN_TYPE_SCHEMA_OPERATORS[(fieldSchema as ColumnSchema).columnType as PrimitiveTypes];

    const isOperatorAllowed = !!allowedOperators.find(
      operatorAllowed => operatorAllowed === conditionTree.operator,
    );

    if (!isOperatorAllowed) {
      throw new Error(
        `The given operator ${JSON.stringify(conditionTree)} has an error.\n
         The operator is not allowed with the column type schema. ${JSON.stringify(fieldSchema)}\n
         The allowed types for the given operator are: [${allowedOperators}]`,
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
