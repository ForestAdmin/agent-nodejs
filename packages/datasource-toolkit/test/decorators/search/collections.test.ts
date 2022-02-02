import SearchCollectionDecorator from '../../../dist/decorators/search/collection';
import { Aggregator } from '../../../dist/interfaces/query/condition-tree/branch';
import { Operator } from '../../../dist/interfaces/query/condition-tree/leaf';
import { PrimitiveTypes } from '../../../dist/interfaces/schema';
import ConditionTreeUtils from '../../../dist/utils/condition-tree';
import * as factories from '../../__factories__';

describe('SearchCollectionDecorator', () => {
  describe('refineSchema', () => {
    it('should set the schema searchable', async () => {
      const collection = factories.collection.build();
      const unsearchableSchema = factories.collectionSchema.build({ searchable: false });
      const searchCollectionDecorator = new SearchCollectionDecorator(collection, null);

      const schema = await searchCollectionDecorator.refineSchema(unsearchableSchema);

      expect(schema.searchable).toBe(true);
    });
  });

  describe('refineFilter', () => {
    describe('when the given filter is null', () => {
      test('should return the given filter to return all records', async () => {
        const collection = factories.collection.build();
        const filter = null;

        const searchCollectionDecorator = new SearchCollectionDecorator(collection, null);

        const refinedFilter = await searchCollectionDecorator.refineFilter(filter);
        expect(refinedFilter).toStrictEqual(filter);
      });
    });

    describe('when the search value is null', () => {
      test('should return the given filter to return all records', async () => {
        const collection = factories.collection.build();
        const filter = factories.filter.build({ search: null });

        const searchCollectionDecorator = new SearchCollectionDecorator(collection, null);

        const refinedFilter = await searchCollectionDecorator.refineFilter(filter);
        expect(refinedFilter).toStrictEqual(filter);
      });
    });

    describe('when the given field is not a column', () => {
      test('adds a condition to not return record if it is the only one filter', async () => {
        const collection = factories.collection.build({
          schema: factories.collectionSchema.unsearchable().build({
            fields: {
              fieldName: factories.oneToManySchema.build(),
            },
          }),
        });
        const filter = factories.filter.build({ search: 'a search value' });

        const searchCollectionDecorator = new SearchCollectionDecorator(collection, null);

        const refinedFilter = await searchCollectionDecorator.refineFilter(filter);
        expect(refinedFilter).toEqual({
          search: null,
          conditionTree: ConditionTreeUtils.MatchNone,
        });
      });
    });

    describe('when the collection schema is searchable', () => {
      test('should return the given filter without adding condition', async () => {
        const collection = factories.collection.build({
          schema: factories.collectionSchema.build({ searchable: true }),
        });
        const filter = factories.filter.build({ search: 'a text' });

        const searchCollectionDecorator = new SearchCollectionDecorator(collection, null);

        const refinedFilter = await searchCollectionDecorator.refineFilter(filter);
        expect(refinedFilter).toStrictEqual(filter);
      });
    });

    describe('when the search is defined and the collection schema is not searchable', () => {
      describe('when the search is empty', () => {
        test('returns the same filter and set search as null', async () => {
          const collection = factories.collection.build({
            schema: factories.collectionSchema.unsearchable().build(),
          });
          const filter = factories.filter.build({ search: '     ' });

          const searchCollectionDecorator = new SearchCollectionDecorator(collection, null);

          const refinedFilter = await searchCollectionDecorator.refineFilter(filter);
          expect(refinedFilter).toEqual({ ...filter, search: null });
        });
      });

      describe('when the filter contains already conditions', () => {
        test('should add its conditions to the filter', async () => {
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
            conditionTree: factories.conditionTreeBranch.build({
              aggregator: Aggregator.And,
              conditions: [
                factories.conditionTreeLeaf.build({
                  operator: Operator.Equal,
                  field: 'aFieldName',
                  value: 'fieldValue',
                }),
              ],
            }),
          });

          const searchCollectionDecorator = new SearchCollectionDecorator(collection, null);

          const refinedFilter = await searchCollectionDecorator.refineFilter(filter);
          expect(refinedFilter).toEqual({
            search: null,
            conditionTree: {
              aggregator: 'and',
              conditions: [
                { operator: 'equal', field: 'aFieldName', value: 'fieldValue' },
                { field: 'fieldName', operator: 'contains', value: 'a text' },
              ],
            },
          });
        });
      });

      describe('when the search is a string and the column type is a string', () => {
        test('should return filter with "contains" condition and "or" aggregator', async () => {
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

          const refinedFilter = await searchCollectionDecorator.refineFilter(filter);
          expect(refinedFilter).toEqual({
            search: null,
            conditionTree: { field: 'fieldName', operator: Operator.Contains, value: 'a text' },
          });
        });
      });

      describe('when the search is an uuid and the column type is an uuid', () => {
        test('should return filter with "equal" condition and "or" aggregator', async () => {
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

          const refinedFilter = await searchCollectionDecorator.refineFilter(filter);
          expect(refinedFilter).toEqual({
            search: null,
            conditionTree: {
              field: 'fieldName',
              operator: Operator.Equal,
              value: '2d162303-78bf-599e-b197-93590ac3d315',
            },
          });
        });
      });

      describe('when the search is a number and the column type is a number', () => {
        test('returns "equal" condition, "or" aggregator and cast value to Number', async () => {
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

          const refinedFilter = await searchCollectionDecorator.refineFilter(filter);
          expect(refinedFilter).toEqual({
            search: null,
            conditionTree: { field: 'fieldName', operator: Operator.Equal, value: 1584 },
          });
        });
      });

      describe('when the search is an string and the column type is an enum', () => {
        test('should return filter with "equal" condition and "or" aggregator', async () => {
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

          const refinedFilter = await searchCollectionDecorator.refineFilter(filter);
          expect(refinedFilter).toEqual({
            search: null,
            conditionTree: { field: 'fieldName', operator: Operator.Equal, value: 'AEnumValue' },
          });
        });

        describe('when the search value does not match any enum', () => {
          test('adds a condition to not return record if it is the only one filter', async () => {
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

            const refinedFilter = await searchCollectionDecorator.refineFilter(filter);
            expect(refinedFilter).toEqual({
              search: null,
              conditionTree: ConditionTreeUtils.MatchNone,
            });
          });
        });

        describe('when the enum values are not defined', () => {
          test('adds a condition to not return record if it is the only one filter', async () => {
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

            const refinedFilter = await searchCollectionDecorator.refineFilter(filter);
            expect(refinedFilter).toEqual({
              search: null,
              conditionTree: ConditionTreeUtils.MatchNone,
            });
          });
        });

        describe('when the column type is not searchable', () => {
          test('adds a condition to not return record if it is the only one filter', async () => {
            const collection = factories.collection.build({
              schema: factories.collectionSchema.unsearchable().build({
                fields: {
                  fieldName: factories.columnSchema.build({ columnType: PrimitiveTypes.Boolean }),
                },
              }),
            });

            const filter = factories.filter.build({ search: '1584' });

            const searchCollectionDecorator = new SearchCollectionDecorator(collection, null);

            const refinedFilter = await searchCollectionDecorator.refineFilter(filter);
            expect(refinedFilter).toEqual({
              search: null,
              conditionTree: ConditionTreeUtils.MatchNone,
            });
          });
        });
      });

      describe('when there are several fields', () => {
        test('should return all the number fields when a number is researched', async () => {
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

          const refinedFilter = await searchCollectionDecorator.refineFilter(filter);
          expect(refinedFilter).toEqual({
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
          test('should return all the uuid fields when uuid is researched', async () => {
            const dataSource = factories.dataSource.buildWithCollections([
              factories.collection.build({
                name: 'books',
                schema: factories.collectionSchema.unsearchable().build({
                  fields: {
                    id: factories.columnSchema.isPrimaryKey().build(),
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
                    bookId: factories.columnSchema.isPrimaryKey().build(),
                    personId: factories.columnSchema.isPrimaryKey().build(),
                  },
                }),
              }),
              factories.collection.build({
                name: 'persons',
                schema: factories.collectionSchema.unsearchable().build({
                  fields: {
                    id: factories.columnSchema.isPrimaryKey().build(),
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

            const refinedFilter = await searchCollectionDecorator.refineFilter(filter);
            expect(refinedFilter).toEqual({
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
