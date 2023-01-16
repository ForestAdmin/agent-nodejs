import ConditionTree from '../../../src/interfaces/query/condition-tree/nodes/base';
import { Aggregator } from '../../../src/interfaces/query/condition-tree/nodes/branch';
import ConditionTreeValidator from '../../../src/validation/condition-tree';
import * as factories from '../../__factories__';

describe('ConditionTreeValidation', () => {
  describe('validate', () => {
    describe('Invalid type', () => {
      it('should throw an error', () => {
        const collection = factories.collection.build();
        const conditionTree = new Date() as unknown as ConditionTree;

        expect(() => ConditionTreeValidator.validate(conditionTree, collection)).toThrow(
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

        expect(() => ConditionTreeValidator.validate(conditionTree, collection)).toThrow(
          "The given aggregator 'and' is not supported. The supported values are: ['Or', 'And']",
        );
      });
    });

    describe('Invalid conditions on branch', () => {
      it('should throw an error', () => {
        const collection = factories.collection.build();
        const conditionTree = factories.conditionTreeBranch.build({ conditions: null });

        expect(() => ConditionTreeValidator.validate(conditionTree, collection)).toThrow(
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

        expect(() => ConditionTreeValidator.validate(conditionTree, collection)).toThrow(
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
                  id: factories.columnSchema.uuidPrimaryKey().build(),
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
                  id: factories.columnSchema.uuidPrimaryKey().build({
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
          ).not.toThrow();
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

        expect(() => ConditionTreeValidator.validate(conditionTree, collection)).not.toThrow();
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

          expect(() => ConditionTreeValidator.validate(conditionTree, collection)).not.toThrow();
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

        expect(() => ConditionTreeValidator.validate(conditionTree, collection)).toThrow();
      });
    });
  });
});
