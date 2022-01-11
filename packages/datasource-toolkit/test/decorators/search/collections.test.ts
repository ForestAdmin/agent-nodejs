import factories from '../../__factories__';
import SearchCollectionDecorator from '../../../src/decorators/search/collection';
import { Operator, PrimitiveTypes } from '../../../src';
import { ConditionTreeNotMatchAnyResult } from '../../../src/utils/condition-tree';

describe('SearchCollection', () => {
  describe('refineFilter', () => {
    describe('when the given filter is empty', () => {
      test('should return the given filter', () => {
        const collection = factories.collection.build();
        const filter = factories.filter.build({});

        const searchCollectionDecorator = new SearchCollectionDecorator(collection);

        const refinedFilter = searchCollectionDecorator.refineFilter(filter);
        expect(refinedFilter).toStrictEqual(filter);
      });
    });

    describe('when the search value is null', () => {
      test('should return the given filter', () => {
        const collection = factories.collection.build();
        const filter = factories.filter.build({ search: null });

        const searchCollectionDecorator = new SearchCollectionDecorator(collection);

        const refinedFilter = searchCollectionDecorator.refineFilter(filter);
        expect(refinedFilter).toStrictEqual(filter);
      });
    });

    describe('when the column types is not searchable', () => {
      test('should return filter that does not match any record', () => {
        const collection = factories.collection.build({
          dataSource: factories.dataSource.build(),
          schema: factories.collectionSchema.build({
            searchable: false,
            fields: {
              fieldName: factories.oneToManySchema.build(),
            },
          }),
        });
        const filter = factories.filter.build({ search: 'a search value' });

        const searchCollectionDecorator = new SearchCollectionDecorator(collection);

        const refinedFilter = searchCollectionDecorator.refineFilter(filter);
        expect(refinedFilter).toStrictEqual({
          search: null,
          conditionTree: ConditionTreeNotMatchAnyResult,
        });
      });
    });

    describe('when the collection schema is searchable', () => {
      test('should return the given filter', () => {
        const collection = factories.collection.build({
          schema: factories.collectionSchema.build({ searchable: true }),
        });
        const filter = factories.filter.build({ search: 'a text' });

        const searchCollectionDecorator = new SearchCollectionDecorator(collection);

        const refinedFilter = searchCollectionDecorator.refineFilter(filter);
        expect(refinedFilter).toStrictEqual(filter);
      });
    });

    describe('when the search is given and the collection schema is not searchable', () => {
      describe('when the search is white spaces', () => {
        test('should return the same filter with search as null', () => {
          const collection = factories.collection.build({
            schema: factories.collectionSchema.build({ searchable: false }),
          });
          const filter = factories.filter.build({ search: '     ' });

          const searchCollectionDecorator = new SearchCollectionDecorator(collection);

          const refinedFilter = searchCollectionDecorator.refineFilter(filter);
          expect(refinedFilter).toStrictEqual({ ...filter, search: null });
        });
      });

      describe('when the search is a string and the column type is a string', () => {
        test('should return filter with "contains" condition and "or" aggregator', () => {
          const collection = factories.collection.build({
            dataSource: factories.dataSource.build(),
            schema: factories.collectionSchema.build({
              searchable: false,
              fields: {
                fieldName: factories.columnSchema.build({
                  columnType: PrimitiveTypes.String,
                }),
              },
            }),
          });

          const filter = factories.filter.build({ search: 'a text' });

          const searchCollectionDecorator = new SearchCollectionDecorator(collection);

          const refinedFilter = searchCollectionDecorator.refineFilter(filter);
          expect(refinedFilter).toStrictEqual({
            search: null,
            conditionTree: {
              aggregator: 'or',
              conditions: [
                {
                  field: 'fieldName',
                  operator: Operator.Contains,
                  value: 'a text',
                },
              ],
            },
          });
        });
      });

      describe('when the search is an uuid and the column type is an uuid', () => {
        test('should return filter with "equal" condition and "or" aggregator', () => {
          const collection = factories.collection.build({
            dataSource: factories.dataSource.build(),
            schema: factories.collectionSchema.build({
              searchable: false,
              fields: {
                fieldName: factories.columnSchema.build({
                  columnType: PrimitiveTypes.Uuid,
                }),
              },
            }),
          });

          const filter = factories.filter.build({ search: '2d162303-78bf-599e-b197-93590ac3d315' });

          const searchCollectionDecorator = new SearchCollectionDecorator(collection);

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
        test('should return filter with "equal" condition and "or" aggregator', () => {
          const collection = factories.collection.build({
            dataSource: factories.dataSource.build(),
            schema: factories.collectionSchema.build({
              searchable: false,
              fields: {
                fieldName: factories.columnSchema.build({
                  columnType: PrimitiveTypes.Number,
                }),
              },
            }),
          });

          const filter = factories.filter.build({ search: '1584' });

          const searchCollectionDecorator = new SearchCollectionDecorator(collection);

          const refinedFilter = searchCollectionDecorator.refineFilter(filter);
          expect(refinedFilter).toStrictEqual({
            search: null,
            conditionTree: {
              aggregator: 'or',
              conditions: [
                {
                  field: 'fieldName',
                  operator: Operator.Equal,
                  value: 1584,
                },
              ],
            },
          });
        });
      });

      describe('when the search is an string and the column type is an enum', () => {
        test('should return filter with "equal" condition and "or" aggregator', () => {
          const collection = factories.collection.build({
            dataSource: factories.dataSource.build(),
            schema: factories.collectionSchema.build({
              searchable: false,
              fields: {
                fieldName: factories.columnSchema.build({
                  columnType: PrimitiveTypes.Enum,
                  enumValues: ['AEnumValue'],
                }),
              },
            }),
          });

          const filter = factories.filter.build({ search: 'AEnumValue' });

          const searchCollectionDecorator = new SearchCollectionDecorator(collection);

          const refinedFilter = searchCollectionDecorator.refineFilter(filter);
          expect(refinedFilter).toStrictEqual({
            search: null,
            conditionTree: {
              aggregator: 'or',
              conditions: [
                {
                  field: 'fieldName',
                  operator: Operator.Equal,
                  value: 'AEnumValue',
                },
              ],
            },
          });
        });

        describe('when the search value does not match any enum', () => {
          test('should return filter that does not match any record', () => {
            const collection = factories.collection.build({
              dataSource: factories.dataSource.build(),
              schema: factories.collectionSchema.build({
                searchable: false,
                fields: {
                  fieldName: factories.columnSchema.build({
                    columnType: PrimitiveTypes.Enum,
                    enumValues: ['AEnumValue'],
                  }),
                },
              }),
            });

            const filter = factories.filter.build({ search: 'NotExistEnum' });

            const searchCollectionDecorator = new SearchCollectionDecorator(collection);

            const refinedFilter = searchCollectionDecorator.refineFilter(filter);
            expect(refinedFilter).toStrictEqual({
              search: null,
              conditionTree: ConditionTreeNotMatchAnyResult,
            });
          });
        });

        describe('when the enum values are not defined', () => {
          test('should return filter that does not match any record', () => {
            const collection = factories.collection.build({
              dataSource: factories.dataSource.build(),
              schema: factories.collectionSchema.build({
                searchable: false,
                fields: {
                  fieldName: factories.columnSchema.build({
                    columnType: PrimitiveTypes.Enum,
                    // enum values is not defined
                  }),
                },
              }),
            });

            const filter = factories.filter.build({ search: 'NotExistEnum' });

            const searchCollectionDecorator = new SearchCollectionDecorator(collection);

            const refinedFilter = searchCollectionDecorator.refineFilter(filter);
            expect(refinedFilter).toStrictEqual({
              search: null,
              conditionTree: ConditionTreeNotMatchAnyResult,
            });
          });
        });

        describe('when the column type is not searchable', () => {
          test('should return filter that does not match any record', () => {
            const collection = factories.collection.build({
              dataSource: factories.dataSource.build(),
              schema: factories.collectionSchema.build({
                searchable: false,
                fields: {
                  fieldName: factories.columnSchema.build({
                    columnType: PrimitiveTypes.Boolean,
                  }),
                },
              }),
            });

            const filter = factories.filter.build({ search: '1584' });

            const searchCollectionDecorator = new SearchCollectionDecorator(collection);

            const refinedFilter = searchCollectionDecorator.refineFilter(filter);
            expect(refinedFilter).toStrictEqual({
              search: null,
              conditionTree: ConditionTreeNotMatchAnyResult,
            });
          });
        });
      });
    });
  });
});
