import SearchCollectionDecorator from '../../../src/decorators/search/collection';
import { Aggregator, Operator } from '../../../src/interfaces/query/selection';
import { PrimitiveTypes } from '../../../src/interfaces/schema';
import { ConditionTreeNotMatchAnyResult } from '../../../src/utils/condition-tree';
import * as factories from '../../__factories__';

describe('SearchCollectionDecorator', () => {
  describe('refineSchema', () => {
    it('should set the schema searchable', () => {
      const collection = factories.collection.build();
      const unsearchableSchema = factories.collectionSchema.build({ searchable: false });
      const searchCollectionDecorator = new SearchCollectionDecorator(collection, null);

      const schema = searchCollectionDecorator.refineSchema(unsearchableSchema);

      expect(schema.searchable).toBe(true);
    });
  });

  describe('refineFilter', () => {
    describe('when the given filter is null', () => {
      test('should return the given filter to return all records', () => {
        const collection = factories.collection.build();
        const filter = null;

        const searchCollectionDecorator = new SearchCollectionDecorator(collection, null);

        const refinedFilter = searchCollectionDecorator.refineFilter(filter);
        expect(refinedFilter).toStrictEqual(filter);
      });
    });

    describe('when the search value is null', () => {
      test('should return the given filter to return all records', () => {
        const collection = factories.collection.build();
        const filter = factories.filter.build({ search: null });

        const searchCollectionDecorator = new SearchCollectionDecorator(collection, null);

        const refinedFilter = searchCollectionDecorator.refineFilter(filter);
        expect(refinedFilter).toStrictEqual(filter);
      });
    });

    describe('when the given field is not a column', () => {
      test('adds a condition to not return record if it is the only one filter', () => {
        const collection = factories.collection.build({
          schema: factories.collectionSchema.unsearchable().build({
            fields: {
              fieldName: factories.oneToManySchema.build(),
            },
          }),
        });
        const filter = factories.filter.build({ search: 'a search value' });

        const searchCollectionDecorator = new SearchCollectionDecorator(collection, null);

        const refinedFilter = searchCollectionDecorator.refineFilter(filter);
        expect(refinedFilter).toStrictEqual({
          search: null,
          conditionTree: ConditionTreeNotMatchAnyResult,
        });
      });
    });

    describe('when the collection schema is searchable', () => {
      test('should return the given filter without adding condition', () => {
        const collection = factories.collection.build({
          schema: factories.collectionSchema.build({ searchable: true }),
        });
        const filter = factories.filter.build({ search: 'a text' });

        const searchCollectionDecorator = new SearchCollectionDecorator(collection, null);

        const refinedFilter = searchCollectionDecorator.refineFilter(filter);
        expect(refinedFilter).toStrictEqual(filter);
      });
    });

    describe('when the search is defined and the collection schema is not searchable', () => {
      describe('when the search is empty', () => {
        test('returns the same filter and set search as null to return all the records', () => {
          const collection = factories.collection.build({
            schema: factories.collectionSchema.unsearchable().build(),
          });
          const filter = factories.filter.build({ search: '     ' });

          const searchCollectionDecorator = new SearchCollectionDecorator(collection, null);

          const refinedFilter = searchCollectionDecorator.refineFilter(filter);
          expect(refinedFilter).toStrictEqual({ ...filter, search: null });
        });
      });

      describe('when the filter contains already conditions', () => {
        test('should add its conditions to the filter', () => {
          const collection = factories.collection.build({
            schema: factories.collectionSchema.unsearchable().build({
              fields: {
                fieldName: factories.columnSchema.build({
                  columnType: PrimitiveTypes.String,
                }),
              },
            }),
          });

          const filter = factories.filter.build({
            search: 'a text',
            conditionTree: {
              aggregator: Aggregator.And,
              conditions: [{ operator: Operator.Equal, field: 'aFieldName', value: 'fieldValue' }],
            },
          });

          const searchCollectionDecorator = new SearchCollectionDecorator(collection, null);

          const refinedFilter = searchCollectionDecorator.refineFilter(filter);
          expect(refinedFilter).toStrictEqual({
            search: null,
            conditionTree: {
              aggregator: 'and',
              conditions: [
                { operator: 'equal', field: 'aFieldName', value: 'fieldValue' },
                {
                  aggregator: 'or',
                  conditions: [{ field: 'fieldName', operator: 'contains', value: 'a text' }],
                },
              ],
            },
          });
        });
      });

      describe('when the search is a string and the column type is a string', () => {
        test('should return filter with "contains" condition and "or" aggregator', () => {
          const collection = factories.collection.build({
            schema: factories.collectionSchema.unsearchable().build({
              fields: {
                fieldName: factories.columnSchema.build({
                  columnType: PrimitiveTypes.String,
                }),
              },
            }),
          });

          const filter = factories.filter.build({ search: 'a text' });

          const searchCollectionDecorator = new SearchCollectionDecorator(collection, null);

          const refinedFilter = searchCollectionDecorator.refineFilter(filter);
          expect(refinedFilter).toStrictEqual({
            search: null,
            conditionTree: {
              aggregator: 'or',
              conditions: [{ field: 'fieldName', operator: Operator.Contains, value: 'a text' }],
            },
          });
        });
      });

      describe('when the search is an uuid and the column type is an uuid', () => {
        test('should return filter with "equal" condition and "or" aggregator', () => {
          const collection = factories.collection.build({
            schema: factories.collectionSchema.unsearchable().build({
              fields: {
                fieldName: factories.columnSchema.build({
                  columnType: PrimitiveTypes.Uuid,
                }),
              },
            }),
          });

          const filter = factories.filter.build({ search: '2d162303-78bf-599e-b197-93590ac3d315' });

          const searchCollectionDecorator = new SearchCollectionDecorator(collection, null);

          const refinedFilter = searchCollectionDecorator.refineFilter(filter);
          expect(refinedFilter).toStrictEqual({
            search: null,
            conditionTree: {
              aggregator: 'or',
              conditions: [
                {
                  field: 'fieldName',
                  operator: Operator.Equal,
                  value: '2d162303-78bf-599e-b197-93590ac3d315',
                },
              ],
            },
          });
        });
      });

      describe('when the search is a number and the column type is a number', () => {
        test('returns filter "equal" condition, "or" aggregator and cast value to Number', () => {
          const collection = factories.collection.build({
            schema: factories.collectionSchema.unsearchable().build({
              fields: {
                fieldName: factories.columnSchema.build({
                  columnType: PrimitiveTypes.Number,
                }),
              },
            }),
          });

          const filter = factories.filter.build({ search: '1584' });

          const searchCollectionDecorator = new SearchCollectionDecorator(collection, null);

          const refinedFilter = searchCollectionDecorator.refineFilter(filter);
          expect(refinedFilter).toStrictEqual({
            search: null,
            conditionTree: {
              aggregator: 'or',
              conditions: [{ field: 'fieldName', operator: Operator.Equal, value: 1584 }],
            },
          });
        });
      });

      describe('when the search is an string and the column type is an enum', () => {
        test('should return filter with "equal" condition and "or" aggregator', () => {
          const collection = factories.collection.build({
            schema: factories.collectionSchema.unsearchable().build({
              fields: {
                fieldName: factories.columnSchema.build({
                  columnType: PrimitiveTypes.Enum,
                  enumValues: ['AEnumValue'],
                }),
              },
            }),
          });

          const filter = factories.filter.build({ search: 'AEnumValue' });

          const searchCollectionDecorator = new SearchCollectionDecorator(collection, null);

          const refinedFilter = searchCollectionDecorator.refineFilter(filter);
          expect(refinedFilter).toStrictEqual({
            search: null,
            conditionTree: {
              aggregator: 'or',
              conditions: [{ field: 'fieldName', operator: Operator.Equal, value: 'AEnumValue' }],
            },
          });
        });

        describe('when the search value does not match any enum', () => {
          test('adds a condition to not return record if it is the only one filter', () => {
            const collection = factories.collection.build({
              schema: factories.collectionSchema.unsearchable().build({
                fields: {
                  fieldName: factories.columnSchema.build({
                    columnType: PrimitiveTypes.Enum,
                    enumValues: ['AEnumValue'],
                  }),
                },
              }),
            });

            const filter = factories.filter.build({ search: 'NotExistEnum' });

            const searchCollectionDecorator = new SearchCollectionDecorator(collection, null);

            const refinedFilter = searchCollectionDecorator.refineFilter(filter);
            expect(refinedFilter).toStrictEqual({
              search: null,
              conditionTree: ConditionTreeNotMatchAnyResult,
            });
          });
        });

        describe('when the enum values are not defined', () => {
          test('adds a condition to not return record if it is the only one filter', () => {
            const collection = factories.collection.build({
              schema: factories.collectionSchema.unsearchable().build({
                fields: {
                  fieldName: factories.columnSchema.build({
                    columnType: PrimitiveTypes.Enum,
                    // enum values is not defined
                  }),
                },
              }),
            });

            const filter = factories.filter.build({ search: 'NotExistEnum' });

            const searchCollectionDecorator = new SearchCollectionDecorator(collection, null);

            const refinedFilter = searchCollectionDecorator.refineFilter(filter);
            expect(refinedFilter).toStrictEqual({
              search: null,
              conditionTree: ConditionTreeNotMatchAnyResult,
            });
          });
        });

        describe('when the column type is not searchable', () => {
          test('adds a condition to not return record if it is the only one filter', () => {
            const collection = factories.collection.build({
              schema: factories.collectionSchema.unsearchable().build({
                fields: {
                  fieldName: factories.columnSchema.build({ columnType: PrimitiveTypes.Boolean }),
                },
              }),
            });

            const filter = factories.filter.build({ search: '1584' });

            const searchCollectionDecorator = new SearchCollectionDecorator(collection, null);

            const refinedFilter = searchCollectionDecorator.refineFilter(filter);
            expect(refinedFilter).toStrictEqual({
              search: null,
              conditionTree: ConditionTreeNotMatchAnyResult,
            });
          });
        });
      });

      describe('when there are several fields', () => {
        test('should return all the number fields when a number is researched', () => {
          const collection = factories.collection.build({
            schema: factories.collectionSchema.unsearchable().build({
              fields: {
                numberField1: factories.columnSchema.build({ columnType: PrimitiveTypes.Number }),
                numberField2: factories.columnSchema.build({ columnType: PrimitiveTypes.Number }),
                fieldNotReturned: factories.columnSchema.build({ columnType: PrimitiveTypes.Uuid }),
              },
            }),
          });

          const filter = factories.filter.build({ search: '1584' });

          const searchCollectionDecorator = new SearchCollectionDecorator(collection, null);

          const refinedFilter = searchCollectionDecorator.refineFilter(filter);
          expect(refinedFilter).toStrictEqual({
            search: null,
            conditionTree: {
              aggregator: 'or',
              conditions: [
                { field: 'numberField1', operator: Operator.Equal, value: 1584 },
                { field: 'numberField2', operator: Operator.Equal, value: 1584 },
              ],
            },
          });
        });

        describe('when it is a deep search with relation fields', () => {
          test('should return all the uuid fields when uuid is researched', () => {
            const dataSource = factories.dataSource.buildWithCollections([
              factories.collection.build({
                name: 'books',
                schema: factories.collectionSchema.unsearchable().build({
                  fields: {
                    id: factories.columnSchema.build({
                      columnType: PrimitiveTypes.Uuid,
                      isPrimaryKey: true,
                    }),
                    myPersons: factories.oneToOneSchema.build({
                      foreignCollection: 'persons',
                      foreignKey: 'personId',
                    }),
                    myBookPersons: factories.manyToOneSchema.build({
                      foreignCollection: 'bookPersons',
                      foreignKey: 'bookId',
                    }),
                  },
                }),
              }),
              factories.collection.build({
                name: 'bookPersons',
                schema: factories.collectionSchema.unsearchable().build({
                  fields: {
                    bookId: factories.columnSchema.build({
                      columnType: PrimitiveTypes.Uuid,
                      isPrimaryKey: true,
                    }),
                    personId: factories.columnSchema.build({
                      columnType: PrimitiveTypes.Uuid,
                      isPrimaryKey: true,
                    }),
                  },
                }),
              }),
              factories.collection.build({
                name: 'persons',
                schema: factories.collectionSchema.unsearchable().build({
                  fields: {
                    id: factories.columnSchema.build({
                      columnType: PrimitiveTypes.Uuid,
                      isPrimaryKey: true,
                    }),
                  },
                }),
              }),
            ]);

            const filter = factories.filter.build({
              searchExtended: true,
              search: '2d162303-78bf-599e-b197-93590ac3d315',
            });

            const searchCollectionDecorator = new SearchCollectionDecorator(
              dataSource.collections[0],
              null,
            );

            const refinedFilter = searchCollectionDecorator.refineFilter(filter);
            expect(refinedFilter).toStrictEqual({
              searchExtended: true,
              search: null,
              conditionTree: {
                aggregator: 'or',
                conditions: [
                  { field: 'id', operator: 'equal', value: '2d162303-78bf-599e-b197-93590ac3d315' },
                  {
                    field: 'myPersons:id',
                    operator: 'equal',
                    value: '2d162303-78bf-599e-b197-93590ac3d315',
                  },
                  {
                    field: 'myBookPersons:bookId',
                    operator: 'equal',
                    value: '2d162303-78bf-599e-b197-93590ac3d315',
                  },
                  {
                    field: 'myBookPersons:personId',
                    operator: 'equal',
                    value: '2d162303-78bf-599e-b197-93590ac3d315',
                  },
                ],
              },
            });
          });
        });
      });
    });
  });
});
