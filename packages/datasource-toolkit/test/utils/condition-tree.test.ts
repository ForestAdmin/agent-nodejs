import { Aggregator, ConditionTreeLeaf, Operator } from '../../src/interfaces/query/selection';
import ConditionTreeUtils from '../../src/utils/condition-tree';
import * as factories from '../__factories__';
import { FieldTypes, PrimitiveTypes } from '../../src/interfaces/schema';

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

      describe('when there are relations in the datasource', () => {
        it('should not throw an error', () => {
          const dataSource = factories.dataSource.buildWithCollections([
            factories.collection.build({
              name: 'books',
              schema: factories.collectionSchema.build({
                fields: {
                  id: {
                    type: FieldTypes.Column,
                    columnType: PrimitiveTypes.Uuid,
                    isPrimaryKey: true,
                  },
                  author: {
                    type: FieldTypes.ManyToOne,
                    foreignCollection: 'persons',
                    foreignKey: 'authorId',
                  },
                  authorId: {
                    type: FieldTypes.Column,
                    columnType: PrimitiveTypes.Uuid,
                  },
                },
              }),
            }),
            factories.collection.build({
              name: 'persons',
              schema: factories.collectionSchema.build({
                fields: {
                  id: {
                    type: FieldTypes.Column,
                    columnType: PrimitiveTypes.Uuid,
                    isPrimaryKey: true,
                  },
                },
              }),
            }),
          ]);

          const conditionTree = factories.conditionTreeBranch.build({
            aggregator: Aggregator.Or,
            conditions: [
              factories.conditionTreeBranch.build({
                aggregator: Aggregator.Or,
                conditions: [
                  factories.conditionTreeLeaf.build({
                    operator: Operator.Equal,
                    value: '2d162303-78bf-599e-b197-93590ac3d315',
                    field: 'author:id',
                  }),
                ],
              }),
            ],
          });

          expect(() =>
            ConditionTreeUtils.validate(conditionTree, dataSource.getCollection('books')),
          ).not.toThrowError();
        });
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
          "The given operator 'contains' is not allowed with the columnType schema: 'Number'. \n" +
            'The allowed types are: ' +
            '[present,blank,equal,not_equal,greater_than,less_than,in,not_in]',
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
          "The given value attribute 'null (type: null)' has an unexpected " +
            "value for the given operator 'greater_than'.\n " +
            'The allowed types of the field value are: [Number,Timeonly].',
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
          "The given value '[1,2,3] (type: ArrayOfNumber)' " +
            "is not allowed with the columnType schema 'String'. \n" +
            'The allowed values are [String,ArrayOfString].',
        );
      });
    });

    describe('when the field is an enum', () => {
      it('should throw an error when the field value is not a valid enum', () => {
        const conditionTree = factories.conditionTreeBranch.build({
          aggregator: Aggregator.Or,
          conditions: [
            factories.conditionTreeBranch.build({
              aggregator: Aggregator.Or,
              conditions: [
                factories.conditionTreeLeaf.build({
                  operator: Operator.Equal,
                  value: 'aRandomValue',
                  field: 'enumField',
                }),
              ],
            }),
          ],
        });
        const collection = factories.collection.build({
          schema: factories.collectionSchema.build({
            fields: {
              enumField: factories.columnSchema.build({
                columnType: PrimitiveTypes.Enum,
                enumValues: ['anAllowedValue'],
              }),
            },
          }),
        });

        expect(() => ConditionTreeUtils.validate(conditionTree, collection)).toThrow(
          'The given enum value(s) [aRandomValue] is not listed in [anAllowedValue]',
        );
      });

      it('should throw an error when the at least one field value is not a valid enum', () => {
        const conditionTree = factories.conditionTreeBranch.build({
          aggregator: Aggregator.Or,
          conditions: [
            factories.conditionTreeBranch.build({
              aggregator: Aggregator.Or,
              conditions: [
                factories.conditionTreeLeaf.build({
                  operator: Operator.In,
                  value: ['allowedValue', 'aRandomValue'],
                  field: 'enumField',
                }),
              ],
            }),
          ],
        });
        const collection = factories.collection.build({
          schema: factories.collectionSchema.build({
            fields: {
              enumField: factories.columnSchema.build({
                columnType: PrimitiveTypes.Enum,
                enumValues: ['allowedValue'],
              }),
            },
          }),
        });

        expect(() => ConditionTreeUtils.validate(conditionTree, collection)).toThrow(
          'The given enum value(s) [allowedValue,aRandomValue] is not listed in [allowedValue]',
        );
      });

      it('should not throw an error when all enum values are allowed', () => {
        const conditionTree = factories.conditionTreeBranch.build({
          aggregator: Aggregator.Or,
          conditions: [
            factories.conditionTreeBranch.build({
              aggregator: Aggregator.Or,
              conditions: [
                factories.conditionTreeLeaf.build({
                  operator: Operator.In,
                  value: ['allowedValue', 'otherAllowedValue'],
                  field: 'enumField',
                }),
              ],
            }),
          ],
        });
        const collection = factories.collection.build({
          schema: factories.collectionSchema.build({
            fields: {
              enumField: factories.columnSchema.build({
                columnType: PrimitiveTypes.Enum,
                enumValues: ['allowedValue', 'otherAllowedValue'],
              }),
            },
          }),
        });

        expect(() => ConditionTreeUtils.validate(conditionTree, collection)).not.toThrow();
      });
    });

    describe('when the field is a Point', () => {
      it('should not throw an error when the filter value is well formatted', () => {
        const conditionTree = factories.conditionTreeBranch.build({
          aggregator: Aggregator.Or,
          conditions: [
            factories.conditionTreeBranch.build({
              aggregator: Aggregator.Or,
              conditions: [
                factories.conditionTreeLeaf.build({
                  operator: Operator.Equal,
                  value: [-80, 20],
                  field: 'pointField',
                }),
              ],
            }),
          ],
        });
        const collection = factories.collection.build({
          schema: factories.collectionSchema.build({
            fields: {
              pointField: factories.columnSchema.build({
                columnType: PrimitiveTypes.Point,
              }),
            },
          }),
        });

        expect(() => ConditionTreeUtils.validate(conditionTree, collection)).not.toThrow();
      });

      describe('when the field value is not well formatted', () => {
        it('should throw an error', () => {
          const conditionTree = factories.conditionTreeBranch.build({
            aggregator: Aggregator.Or,
            conditions: [
              factories.conditionTreeBranch.build({
                aggregator: Aggregator.Or,
                conditions: [
                  factories.conditionTreeLeaf.build({
                    operator: Operator.Equal,
                    value: [-80, 20, 90],
                    field: 'pointField',
                  }),
                ],
              }),
            ],
          });
          const collection = factories.collection.build({
            schema: factories.collectionSchema.build({
              fields: {
                pointField: factories.columnSchema.build({
                  columnType: PrimitiveTypes.Point,
                }),
              },
            }),
          });

          expect(() => ConditionTreeUtils.validate(conditionTree, collection)).toThrow(
            "The given Point value '[-80,20,90]' is badly formatted. The format is: [x,y].",
          );
        });
      });
    });
  });
});
