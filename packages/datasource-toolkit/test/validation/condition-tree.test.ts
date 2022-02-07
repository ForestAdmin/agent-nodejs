import { Aggregator } from '../../src/interfaces/query/condition-tree/branch';
import { Operator } from '../../src/interfaces/query/condition-tree/leaf';
import { FieldTypes, PrimitiveTypes } from '../../src/interfaces/schema';
import ConditionTreeValidator from '../../src/validation/condition-tree';
import * as factories from '../__factories__';

describe('ConditionTreeValidation', () => {
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
                filterOperators: new Set(Object.values(Operator)),
              }),
            },
          }),
        });

        expect(() => ConditionTreeValidator.validate(conditionTree, collection)).toThrowError(
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
                    filterOperators: new Set(Object.values(Operator)),
                  },
                  author: {
                    type: FieldTypes.ManyToOne,
                    foreignCollection: 'persons',
                    foreignKey: 'authorId',
                  },
                  authorId: {
                    type: FieldTypes.Column,
                    columnType: PrimitiveTypes.Uuid,
                    filterOperators: new Set(Object.values(Operator)),
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
                    filterOperators: new Set(Object.values(Operator)),
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
            ConditionTreeValidator.validate(conditionTree, dataSource.getCollection('books')),
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
                  filterOperators: new Set(Object.values(Operator)),
                }),
              },
            }),
          });

          expect(() => ConditionTreeValidator.validate(conditionTree, collection)).toThrow(
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
                filterOperators: new Set(Object.values(Operator)),
              }),
            },
          }),
        });

        expect(() => ConditionTreeValidator.validate(conditionTree, collection)).not.toThrowError();
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
                  filterOperators: new Set(Object.values(Operator)),
                }),
              },
            }),
          });

          expect(() =>
            ConditionTreeValidator.validate(conditionTree, collection),
          ).not.toThrowError();
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
                filterOperators: new Set(Object.values(Operator)),
              }),
            },
          }),
        });

        expect(() => ConditionTreeValidator.validate(conditionTree, collection)).toThrow(
          "The given operator 'contains' is not allowed with the columnType schema: 'Number'.\n" +
            'The allowed types are: ' +
            '[blank,equal,missing,not_equal,present,greater_than,less_than,in,not_in]',
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
                filterOperators: new Set(Object.values(Operator)),
              }),
            },
          }),
        });

        expect(() => ConditionTreeValidator.validate(conditionTree, collection)).toThrow(
          "The given value attribute 'null (type: null)' has an unexpected " +
            "value for the given operator 'greater_than'.\n" +
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
                filterOperators: new Set(Object.values(Operator)),
              }),
            },
          }),
        });

        expect(() => ConditionTreeValidator.validate(conditionTree, collection)).toThrow(
          'Wrong type for "target": 1,2,3. Expects [String,ArrayOfString]',
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
                filterOperators: new Set(Object.values(Operator)),
              }),
            },
          }),
        });

        expect(() => ConditionTreeValidator.validate(conditionTree, collection)).toThrow(
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
                filterOperators: new Set(Object.values(Operator)),
              }),
            },
          }),
        });

        expect(() => ConditionTreeValidator.validate(conditionTree, collection)).toThrow(
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
                filterOperators: new Set(Object.values(Operator)),
              }),
            },
          }),
        });

        expect(() => ConditionTreeValidator.validate(conditionTree, collection)).not.toThrow();
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
                  value: '-80,20',
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
                filterOperators: new Set(Object.values(Operator)),
              }),
            },
          }),
        });

        expect(() => ConditionTreeValidator.validate(conditionTree, collection)).not.toThrow();
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
                    value: '-80, 20, 90',
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
                  filterOperators: new Set(Object.values(Operator)),
                }),
              },
            }),
          });

          expect(() => ConditionTreeValidator.validate(conditionTree, collection)).toThrow(
            'Wrong type for "pointField": -80, 20, 90. Expects [Point]',
          );
        });
      });
    });
  });
});
