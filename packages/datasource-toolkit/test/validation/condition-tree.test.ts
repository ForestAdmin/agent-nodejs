import * as factories from '../__factories__';
import { Aggregator } from '../../src/interfaces/query/condition-tree/nodes/branch';
import { Operator, allOperators } from '../../src/interfaces/query/condition-tree/nodes/operators';
import ConditionTree from '../../src/interfaces/query/condition-tree/nodes/base';
import ConditionTreeValidator from '../../src/validation/condition-tree';

describe('ConditionTreeValidation', () => {
  describe('validate', () => {
    describe('Invalid type', () => {
      it('should throw an error', () => {
        const collection = factories.collection.build();
        const conditionTree = new Date() as unknown as ConditionTree;

        expect(() => ConditionTreeValidator.validate(conditionTree, collection)).toThrowError(
          'Unexpected condition tree type',
        );
      });
    });

    describe('Invalid aggregator on branch', () => {
      it('should throw an error', () => {
        const collection = factories.collection.build();
        const conditionTree = factories.conditionTreeBranch.build({
          aggregator: 'and' as Aggregator, // should be 'And'
        });

        expect(() => ConditionTreeValidator.validate(conditionTree, collection)).toThrowError(
          "The given aggregator 'and' is not supported. The supported values are: ['Or', 'And']",
        );
      });
    });

    describe('Invalid conditions on branch', () => {
      it('should throw an error', () => {
        const collection = factories.collection.build();
        const conditionTree = factories.conditionTreeBranch.build({ conditions: null });

        expect(() => ConditionTreeValidator.validate(conditionTree, collection)).toThrowError(
          `The given conditions 'null' were expected to be an array`,
        );
      });
    });

    describe('when the field(s) does not exist in the schema', () => {
      it('should throw an error', () => {
        const conditionTree = factories.conditionTreeLeaf.build({
          operator: 'Equal',
          value: 'targetValue',
          field: 'fieldDoesNotExistInSchema',
        });
        const collection = factories.collection.build({
          schema: factories.collectionSchema.build({
            fields: {
              target: factories.columnSchema.build({
                columnType: 'String',
              }),
            },
          }),
        });

        expect(() => ConditionTreeValidator.validate(conditionTree, collection)).toThrowError(
          "Column not found 'a collection.fieldDoesNotExistInSchema'",
        );
      });

      describe('when there are relations in the datasource', () => {
        it('should not throw an error', () => {
          const dataSource = factories.dataSource.buildWithCollections([
            factories.collection.build({
              name: 'books',
              schema: factories.collectionSchema.build({
                fields: {
                  id: factories.columnSchema.isPrimaryKey().build(),
                  author: factories.manyToOneSchema.build({
                    foreignCollection: 'persons',
                    foreignKey: 'authorId',
                  }),
                  authorId: factories.columnSchema.build({
                    columnType: 'Uuid',
                  }),
                },
              }),
            }),
            factories.collection.build({
              name: 'persons',
              schema: factories.collectionSchema.build({
                fields: {
                  id: factories.columnSchema.isPrimaryKey().build({
                    filterOperators: new Set(['Equal']),
                  }),
                },
              }),
            }),
          ]);

          const conditionTree = factories.conditionTreeLeaf.build({
            operator: 'Equal',
            value: '2d162303-78bf-599e-b197-93590ac3d315',
            field: 'author:id',
          });

          expect(() =>
            ConditionTreeValidator.validate(conditionTree, dataSource.getCollection('books')),
          ).not.toThrowError();
        });
      });

      describe('when there are several fields', () => {
        it('should throw an error when a field does not exist', () => {
          const conditionTree = factories.conditionTreeBranch.build({
            aggregator: 'Or',
            conditions: [
              factories.conditionTreeLeaf.build({
                operator: 'Equal',
                value: 'targetValue',
                field: 'target',
              }),
              factories.conditionTreeLeaf.build({
                operator: 'Equal',
                value: 'targetValue',
                field: 'fieldDoesNotExistInSchema',
              }),
            ],
          });
          const collection = factories.collection.build({
            schema: factories.collectionSchema.build({
              fields: {
                target: factories.columnSchema.build({
                  columnType: 'String',
                  filterOperators: new Set(['Equal']),
                }),
              },
            }),
          });

          expect(() => ConditionTreeValidator.validate(conditionTree, collection)).toThrow(
            "Column not found 'a collection.fieldDoesNotExistInSchema'",
          );
        });
      });
    });

    describe('when the field(s) exist', () => {
      it('should not throw an error', () => {
        const conditionTree = factories.conditionTreeLeaf.build({
          operator: 'Equal',
          value: 'targetValue',
          field: 'target',
        });
        const collection = factories.collection.build({
          schema: factories.collectionSchema.build({
            fields: {
              target: factories.columnSchema.build({
                columnType: 'String',
                filterOperators: new Set(['Equal']),
              }),
            },
          }),
        });

        expect(() => ConditionTreeValidator.validate(conditionTree, collection)).not.toThrowError();
      });

      describe('when there are several fields', () => {
        it('should not trow an error', () => {
          const conditionTree = factories.conditionTreeBranch.build({
            aggregator: 'Or',
            conditions: [
              factories.conditionTreeLeaf.build({
                operator: 'Equal',
                value: 'targetValue',
                field: 'target',
              }),
              factories.conditionTreeLeaf.build({
                operator: 'Equal',
                value: 'targetValue',
                field: 'target',
              }),
            ],
          });
          const collection = factories.collection.build({
            schema: factories.collectionSchema.build({
              fields: {
                target: factories.columnSchema.build({
                  columnType: 'String',
                  filterOperators: new Set(['Equal']),
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
        const conditionTree = factories.conditionTreeLeaf.build({
          operator: 'Contains',
          field: 'target',
          value: 'subValue',
        });

        const collection = factories.collection.build({
          schema: factories.collectionSchema.build({
            fields: {
              target: factories.columnSchema.build({
                columnType: 'Number',
                filterOperators: new Set(['Contains']),
              }),
            },
          }),
        });

        expect(() => ConditionTreeValidator.validate(conditionTree, collection)).toThrow(
          "The given operator 'Contains' is not allowed with the columnType schema: 'Number'.\n" +
            'The allowed types are: ' +
            '[Blank,Equal,Missing,NotEqual,Present,In,NotIn,IncludesAll,GreaterThan,LessThan]',
        );
      });
    });

    describe('when the operator is incompatible with the given value', () => {
      it('should throw an error', () => {
        const conditionTree = factories.conditionTreeLeaf.build({
          operator: 'GreaterThan',
          field: 'target',
          value: null,
        });

        const collection = factories.collection.build({
          schema: factories.collectionSchema.build({
            fields: {
              target: factories.columnSchema.build({
                columnType: 'Number',
                filterOperators: new Set(['GreaterThan']),
              }),
            },
          }),
        });

        expect(() => ConditionTreeValidator.validate(conditionTree, collection)).toThrow(
          "The given value attribute 'null (type: Null)' has an unexpected " +
            "value for the given operator 'GreaterThan'.\n" +
            'The allowed types of the field value are: [Number,Timeonly].',
        );
      });
    });

    describe('when the value is not compatible with the column type', () => {
      it('should throw an error', () => {
        const conditionTree = factories.conditionTreeLeaf.build({
          operator: 'In',
          value: [1, 2, 3],
          field: 'target',
        });
        const collection = factories.collection.build({
          schema: factories.collectionSchema.build({
            fields: {
              target: factories.columnSchema.build({
                columnType: 'String',
                filterOperators: new Set(['In']),
              }),
            },
          }),
        });

        expect(() => ConditionTreeValidator.validate(conditionTree, collection)).toThrow(
          'Wrong type for "target": 1,2,3. Expects [String,ArrayOfString,Null]',
        );
      });
    });

    describe('when the field is an UUID', () => {
      it('should not throw an error when a list of uuid is given', () => {
        const conditionTree = factories.conditionTreeLeaf.build({
          operator: 'In',
          value: ['2d162303-78bf-599e-b197-93590ac3d315', '2d162303-78bf-599e-b197-93590ac3d315'],
          field: 'uuidField',
        });
        const collection = factories.collection.build({
          schema: factories.collectionSchema.build({
            fields: {
              uuidField: factories.columnSchema.build({
                columnType: 'Uuid',
                filterOperators: new Set(['In']),
              }),
            },
          }),
        });

        expect(() => ConditionTreeValidator.validate(conditionTree, collection)).not.toThrow();
      });

      it('should throw an error when at least one uuid is malformed', () => {
        const conditionTree = factories.conditionTreeLeaf.build({
          operator: 'In',
          value: [
            '2d162303-78bf-599e-b197-93590ac3d315',
            'malformed-2d162303-78bf-599e-b197-93590ac3d315',
          ],
          field: 'uuidField',
        });
        const collection = factories.collection.build({
          schema: factories.collectionSchema.build({
            fields: {
              uuidField: factories.columnSchema.build({
                columnType: 'Uuid',
              }),
            },
          }),
        });

        expect(() => ConditionTreeValidator.validate(conditionTree, collection)).toThrow();
      });
    });

    describe('when the field is an enum', () => {
      it('should throw an error when the field value is not a valid enum', () => {
        const conditionTree = factories.conditionTreeLeaf.build({
          operator: 'Equal',
          value: 'aRandomValue',
          field: 'enumField',
        });
        const collection = factories.collection.build({
          schema: factories.collectionSchema.build({
            fields: {
              enumField: factories.columnSchema.build({
                columnType: 'Enum',
                enumValues: ['anAllowedValue'],
                filterOperators: new Set(['Equal']),
              }),
            },
          }),
        });

        expect(() => ConditionTreeValidator.validate(conditionTree, collection)).toThrow(
          'The given enum value(s) [aRandomValue] is not listed in [anAllowedValue]',
        );
      });

      it('should throw an error when the at least one field value is not a valid enum', () => {
        const conditionTree = factories.conditionTreeLeaf.build({
          operator: 'In',
          value: ['allowedValue', 'aRandomValue'],
          field: 'enumField',
        });
        const collection = factories.collection.build({
          schema: factories.collectionSchema.build({
            fields: {
              enumField: factories.columnSchema.build({
                columnType: 'Enum',
                enumValues: ['allowedValue'],
                filterOperators: new Set(['In']),
              }),
            },
          }),
        });

        expect(() => ConditionTreeValidator.validate(conditionTree, collection)).toThrow(
          'The given enum value(s) [allowedValue,aRandomValue] is not listed in [allowedValue]',
        );
      });

      it('should not throw an error when all enum values are allowed', () => {
        const conditionTree = factories.conditionTreeLeaf.build({
          operator: 'In',
          value: ['allowedValue', 'otherAllowedValue'],
          field: 'enumField',
        });
        const collection = factories.collection.build({
          schema: factories.collectionSchema.build({
            fields: {
              enumField: factories.columnSchema.build({
                columnType: 'Enum',
                enumValues: ['allowedValue', 'otherAllowedValue'],
                filterOperators: new Set(['In']),
              }),
            },
          }),
        });

        expect(() => ConditionTreeValidator.validate(conditionTree, collection)).not.toThrow();
      });
    });

    describe('when the field is a Point', () => {
      it('should not throw an error when the filter value is well formatted', () => {
        const conditionTree = factories.conditionTreeLeaf.build({
          operator: 'Equal',
          value: '-80,20',
          field: 'pointField',
        });
        const collection = factories.collection.build({
          schema: factories.collectionSchema.build({
            fields: {
              pointField: factories.columnSchema.build({
                columnType: 'Point',
                filterOperators: new Set(['Equal']),
              }),
            },
          }),
        });

        expect(() => ConditionTreeValidator.validate(conditionTree, collection)).not.toThrow();
      });

      describe('when the field value is not well formatted', () => {
        it('should throw an error', () => {
          const conditionTree = factories.conditionTreeLeaf.build({
            operator: 'Equal',
            value: '-80, 20, 90',
            field: 'pointField',
          });
          const collection = factories.collection.build({
            schema: factories.collectionSchema.build({
              fields: {
                pointField: factories.columnSchema.build({
                  columnType: 'Point',
                  filterOperators: new Set(['Equal']),
                }),
              },
            }),
          });

          expect(() => ConditionTreeValidator.validate(conditionTree, collection)).toThrow(
            'Wrong type for "pointField": -80, 20, 90. Expects [Point,Null]',
          );
        });
      });
    });

    describe('date operator', () => {
      const setupCollectionWithDateColumn = () => {
        return factories.collection.build({
          schema: factories.collectionSchema.build({
            fields: {
              dateField: factories.columnSchema.build({
                columnType: 'Date',
                filterOperators: new Set(allOperators),
              }),
            },
          }),
        });
      };

      describe('when it does not support a value', () => {
        const operators = [
          'Blank',
          'Missing',
          'Present',
          'Yesterday',
          'Today',
          'PreviousQuarter',
          'PreviousYear',
          'PreviousMonth',
          'PreviousWeek',
          'Past',
          'Future',
          'PreviousWeekToDate',
          'PreviousMonthToDate',
          'PreviousQuarterToDate',
          'PreviousYearToDate',
        ];

        test.each(operators)('[%s] should throw an error when a date is given', operator => {
          const collection = setupCollectionWithDateColumn();
          const conditionTree = factories.conditionTreeLeaf.build({
            operator: operator as Operator,
            value: new Date(),
            field: 'dateField',
          });

          expect(() => ConditionTreeValidator.validate(conditionTree, collection)).toThrow();
        });

        test.each(operators)('[%s] should not throw an error when the value is empty', operator => {
          const collection = setupCollectionWithDateColumn();
          const conditionTree = factories.conditionTreeLeaf.build({
            operator: operator as Operator,
            value: null,
            field: 'dateField',
          });

          expect(() => ConditionTreeValidator.validate(conditionTree, collection)).not.toThrow();
        });
      });

      describe('when it support only a number', () => {
        const operators = [
          'PreviousXDays',
          'BeforeXHoursAgo',
          'AfterXHoursAgo',
          'PreviousXDaysToDate',
        ];

        test.each(operators)('[%s] should throw an error when a date is given', operator => {
          const collection = setupCollectionWithDateColumn();
          const conditionTree = factories.conditionTreeLeaf.build({
            operator: operator as Operator,
            value: new Date(),
            field: 'dateField',
          });

          expect(() => ConditionTreeValidator.validate(conditionTree, collection)).toThrow();
        });

        test.each(operators)(
          '[%s] should not throw an error when the value is a number',
          operator => {
            const collection = setupCollectionWithDateColumn();
            const conditionTree = factories.conditionTreeLeaf.build({
              operator: operator as Operator,
              value: 10,
              field: 'dateField',
            });

            expect(() => ConditionTreeValidator.validate(conditionTree, collection)).not.toThrow();
          },
        );
      });
    });
  });
});
