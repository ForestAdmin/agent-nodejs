import { Aggregator, ConditionTreeLeaf, Operator } from '../../src/interfaces/query/selection';
import ConditionTreeUtils, {
  MAP_OPERATOR_TYPES,
  MAP_COLUMN_TYPE_SCHEMA_OPERATORS,
} from '../../src/utils/condition-tree';
import * as factories from '../__factories__';
import { NonPrimitiveTypes, PrimitiveTypes } from '../../src/interfaces/schema';

describe('ConditionTreeUtils', () => {
  describe('intersect', () => {
    test('intersect() an empty list should return an empty And', () => {
      expect(ConditionTreeUtils.intersect()).toStrictEqual({
        aggregator: Aggregator.And,
        conditions: [],
      });
    });

    test('intersect() should return the parameter when called with only one param', () => {
      expect(
        ConditionTreeUtils.intersect({ field: 'column', operator: Operator.Equal, value: true }),
      ).toStrictEqual({ field: 'column', operator: Operator.Equal, value: true });
    });

    test('intersect() should ignore null params', () => {
      expect(
        ConditionTreeUtils.intersect(
          null,
          { field: 'column', operator: Operator.Equal, value: true },
          null,
        ),
      ).toStrictEqual({ field: 'column', operator: Operator.Equal, value: true });
    });

    test('intersect() multiple trees should return the tree', () => {
      expect(
        ConditionTreeUtils.intersect(
          { field: 'column', operator: Operator.Equal, value: true },
          { field: 'otherColumn', operator: Operator.Equal, value: true },
        ),
      ).toStrictEqual({
        aggregator: Aggregator.And,
        conditions: [
          { field: 'column', operator: Operator.Equal, value: true },
          { field: 'otherColumn', operator: Operator.Equal, value: true },
        ],
      });
    });

    test('intersect() should merge And trees', () => {
      expect(
        ConditionTreeUtils.intersect(
          {
            aggregator: Aggregator.And,
            conditions: [{ field: 'column', operator: Operator.Equal, value: true }],
          },
          {
            aggregator: Aggregator.And,
            conditions: [{ field: 'otherColumn', operator: Operator.Equal, value: true }],
          },
        ),
      ).toStrictEqual({
        aggregator: Aggregator.And,
        conditions: [
          { field: 'column', operator: Operator.Equal, value: true },
          { field: 'otherColumn', operator: Operator.Equal, value: true },
        ],
      });
    });
  });

  describe('isBranch', () => {
    test('isBranch should return true for a branch', () => {
      expect(
        ConditionTreeUtils.isBranch({ aggregator: Aggregator.And, conditions: [] }),
      ).toStrictEqual(true);
    });

    test('isBranch should return false otherwise', () => {
      expect(
        ConditionTreeUtils.isBranch({ field: 'column', operator: Operator.Equal, value: true }),
      ).toStrictEqual(false);
    });
  });

  describe('replaceLeafs', () => {
    const handler = (leaf: ConditionTreeLeaf) => ({ ...leaf, field: `${leaf.field}2` });

    test('should not do anything on a null tree', () => {
      const result = ConditionTreeUtils.replaceLeafs(null, handler);

      expect(result).toStrictEqual(null);
    });

    test('should replace everything on a leaf', () => {
      const result = ConditionTreeUtils.replaceLeafs(
        { field: 'column', operator: Operator.Equal, value: true },
        handler,
      );

      expect(result).toStrictEqual({ field: 'column2', operator: Operator.Equal, value: true });
    });

    test('should replace leafs on a tree with branches', () => {
      const result = ConditionTreeUtils.replaceLeafs(
        {
          aggregator: Aggregator.And,
          conditions: [
            { field: 'column', operator: Operator.Equal, value: true },
            { field: 'otherColumn', operator: Operator.Equal, value: true },
          ],
        },
        handler,
      );

      expect(result).toStrictEqual({
        aggregator: Aggregator.And,
        conditions: [
          { field: 'column2', operator: Operator.Equal, value: true },
          { field: 'otherColumn2', operator: Operator.Equal, value: true },
        ],
      });
    });
  });

  describe('validate', () => {
    describe('when the field(s) does not exist in the schema', () => {
      it('should throw an error', () => {
        const conditionTree = factories.conditionTreeBranch.build({
          aggregator: Aggregator.Or,
          conditions: [
            factories.conditionTreeLeaf.build({
              operator: Operator.Equal,
              value: 'targetValue',
              field: 'fieldDoesNotExistInSchema',
            }),
          ],
        });
        const collection = factories.collection.build({
          schema: factories.collectionSchema.build({
            fields: {
              target: factories.columnSchema.build({
                columnType: PrimitiveTypes.String,
              }),
            },
          }),
        });

        expect(() => ConditionTreeUtils.validate(conditionTree, collection)).toThrowError(
          "Field 'fieldDoesNotExistInSchema' not found on collection 'a collection'",
        );
      });

      describe('when there are several fields', () => {
        it('should throw an error when a field does not exist', () => {
          const conditionTree = factories.conditionTreeBranch.build({
            aggregator: Aggregator.Or,
            conditions: [
              factories.conditionTreeBranch.build({
                aggregator: Aggregator.Or,
                conditions: [
                  factories.conditionTreeLeaf.build({
                    operator: Operator.Equal,
                    value: 'targetValue',
                    field: 'target',
                  }),
                  factories.conditionTreeLeaf.build({
                    operator: Operator.Equal,
                    value: 'targetValue',
                    field: 'fieldDoesNotExistInSchema',
                  }),
                ],
              }),
            ],
          });
          const collection = factories.collection.build({
            schema: factories.collectionSchema.build({
              fields: {
                target: factories.columnSchema.build({
                  columnType: PrimitiveTypes.String,
                }),
              },
            }),
          });

          expect(() => ConditionTreeUtils.validate(conditionTree, collection)).toThrow(
            "Field 'fieldDoesNotExistInSchema' not found on collection 'a collection'",
          );
        });
      });
    });

    describe('when the field(s) exist', () => {
      it('should not throw an error', () => {
        const conditionTree = factories.conditionTreeBranch.build({
          aggregator: Aggregator.Or,
          conditions: [
            factories.conditionTreeLeaf.build({
              operator: Operator.Equal,
              value: 'targetValue',
              field: 'target',
            }),
          ],
        });
        const collection = factories.collection.build({
          schema: factories.collectionSchema.build({
            fields: {
              target: factories.columnSchema.build({
                columnType: PrimitiveTypes.String,
              }),
            },
          }),
        });

        expect(() => ConditionTreeUtils.validate(conditionTree, collection)).not.toThrowError();
      });

      describe('when there are several fields', () => {
        it('should not trow an error', () => {
          const conditionTree = factories.conditionTreeBranch.build({
            aggregator: Aggregator.Or,
            conditions: [
              factories.conditionTreeBranch.build({
                aggregator: Aggregator.Or,
                conditions: [
                  factories.conditionTreeLeaf.build({
                    operator: Operator.Equal,
                    value: 'targetValue',
                    field: 'target',
                  }),
                  factories.conditionTreeLeaf.build({
                    operator: Operator.Equal,
                    value: 'targetValue',
                    field: 'target',
                  }),
                ],
              }),
            ],
          });
          const collection = factories.collection.build({
            schema: factories.collectionSchema.build({
              fields: {
                target: factories.columnSchema.build({
                  columnType: PrimitiveTypes.String,
                }),
              },
            }),
          });

          expect(() => ConditionTreeUtils.validate(conditionTree, collection)).not.toThrowError();
        });
      });
    });

    describe('when the field has an operator incompatible with the schema type', () => {
      it('should throw an error', () => {
        const conditionTree = factories.conditionTreeBranch.build({
          aggregator: Aggregator.Or,
          conditions: [
            factories.conditionTreeLeaf.build({
              operator: Operator.Contains,
              field: 'target',
              value: 'subValue',
            }),
          ],
        });

        const collection = factories.collection.build({
          schema: factories.collectionSchema.build({
            fields: {
              target: factories.columnSchema.build({
                columnType: PrimitiveTypes.Number,
              }),
            },
          }),
        });

        expect(() => ConditionTreeUtils.validate(conditionTree, collection)).toThrow(
          'The given operator of ' +
            '{"operator":"contains","field":"target","value":"subValue"} has an error.\n ' +
            'The operator is not allowed with the column type schema: ' +
            '{"type":"Column","columnType":"Number","filterOperators":{}}\n ' +
            'The allowed types for the given operator are: [present,equal,greater_than,in]' +
            " and the operator is 'contains'",
        );
      });
    });

    describe('when the operator is incompatible with the given value', () => {
      it('should throw an error', () => {
        const conditionTree = factories.conditionTreeBranch.build({
          aggregator: Aggregator.Or,
          conditions: [
            factories.conditionTreeLeaf.build({
              operator: Operator.GreaterThan,
              field: 'target',
              value: null,
            }),
          ],
        });

        const collection = factories.collection.build({
          schema: factories.collectionSchema.build({
            fields: {
              target: factories.columnSchema.build({
                columnType: PrimitiveTypes.Number,
              }),
            },
          }),
        });

        expect(() => ConditionTreeUtils.validate(conditionTree, collection)).toThrow(
          'The given condition of ' +
            '{"operator":"greater_than","field":"target","value":null} has an error.\n ' +
            'The value attribute has an unexpected value for the given operator.\n ' +
            "The allowed field value types are: [Number] and the type is 'null'",
        );
      });
    });

    describe('when the value is not compatible with the column type', () => {
      it('should throw an error', () => {
        const conditionTree = factories.conditionTreeBranch.build({
          aggregator: Aggregator.Or,
          conditions: [
            factories.conditionTreeLeaf.build({
              operator: Operator.In,
              value: [1, 2, 3],
              field: 'target',
            }),
          ],
        });
        const collection = factories.collection.build({
          schema: factories.collectionSchema.build({
            fields: {
              target: factories.columnSchema.build({
                columnType: PrimitiveTypes.String,
              }),
            },
          }),
        });

        expect(() => ConditionTreeUtils.validate(conditionTree, collection)).toThrow(
          'The given value of ' +
            '{"operator":"in","field":"target","value":[1,2,3]} has an error.\n ' +
            'The value is not allowed with the column type schema:' +
            ' {"type":"Column","columnType":"String","filterOperators":{}}\n ' +
            'The allowed values for the column type are: [String,ArrayOfString]',
        );
      });
    });
  });

  describe('MAP_OPERATOR_TYPE', () => {
    it.each([
      [Operator.Present, []],
      [
        Operator.In,
        [
          NonPrimitiveTypes.ArrayOfNumber,
          NonPrimitiveTypes.ArrayOfString,
          NonPrimitiveTypes.EmptyArray,
        ],
      ],
      [Operator.Equal, [PrimitiveTypes.String, PrimitiveTypes.Number, PrimitiveTypes.Uuid]],
      [Operator.Blank, []],
      [Operator.Contains, [PrimitiveTypes.String]],
    ])(`%s should be match the allowed types`, async (operator, expectedAllowedTypes) => {
      expect(MAP_OPERATOR_TYPES[operator]).toStrictEqual(expectedAllowedTypes);
    });

    it.each(Object.keys(Operator))(`should implement %s operator`, async operator => {
      expect(MAP_OPERATOR_TYPES[operator]).toBeDefined();
    });
  });

  describe('MAP_COLUMN_TYPE_SCHEMA_OPERATORS', () => {
    it.each([[PrimitiveTypes.String, [Operator.Present, Operator.Equal]]])(
      `%s should be match the allowed primitive types`,
      async (operator, expectedAllowedTypes) => {
        expect(MAP_COLUMN_TYPE_SCHEMA_OPERATORS[operator]).toStrictEqual(expectedAllowedTypes);
      },
    );

    it.each(Object.keys(PrimitiveTypes))(`should implement %s primitive type`, async operator => {
      expect(MAP_COLUMN_TYPE_SCHEMA_OPERATORS[operator]).toBeDefined();
    });
  });
});
