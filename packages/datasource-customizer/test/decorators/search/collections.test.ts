import { ConditionTreeFactory, ConditionTreeLeaf } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import SearchCollectionDecorator from '../../../src/decorators/search/collection';

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
    describe('when the search value is null', () => {
      test('should return the given filter to return all records', async () => {
        const collection = factories.collection.build();
        const filter = factories.filter.build({ search: null });

        const searchCollectionDecorator = new SearchCollectionDecorator(collection, null);

        const refinedFilter = await searchCollectionDecorator.refineFilter(
          factories.caller.build(),
          filter,
        );
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

        const refinedFilter = await searchCollectionDecorator.refineFilter(
          factories.caller.build(),
          filter,
        );
        expect(refinedFilter).toEqual({
          search: null,
          conditionTree: ConditionTreeFactory.MatchNone,
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

        const refinedFilter = await searchCollectionDecorator.refineFilter(
          factories.caller.build(),
          filter,
        );
        expect(refinedFilter).toStrictEqual(filter);
      });
    });

    describe('when a replacer is provided', () => {
      test('it should be used instead of the default one', async () => {
        const collection = factories.collection.build({
          schema: factories.collectionSchema.build({
            fields: { id: factories.columnSchema.uuidPrimaryKey().build() },
          }),
        });
        const filter = factories.filter.build({ search: 'something' });
        const decorator = new SearchCollectionDecorator(collection, null);
        decorator.replaceSearch(value => ({ field: 'id', operator: 'Equal', value }));

        const refinedFilter = await decorator.refineFilter(factories.caller.build(), filter);
        expect(refinedFilter).toEqual({
          ...filter,
          conditionTree: new ConditionTreeLeaf('id', 'Equal', 'something'),
          search: null,
        });
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

          const refinedFilter = await searchCollectionDecorator.refineFilter(
            factories.caller.build(),
            filter,
          );
          expect(refinedFilter).toEqual({ ...filter, search: null });
        });
      });

      describe('when the filter contains already conditions', () => {
        test('should add its conditions to the filter', async () => {
          const collection = factories.collection.build({
            schema: factories.collectionSchema.unsearchable().build({
              fields: {
                fieldName: factories.columnSchema.build({
                  columnType: 'String',
                  filterOperators: new Set(['IContains']),
                }),
              },
            }),
          });

          const filter = factories.filter.build({
            search: 'a text',
            conditionTree: factories.conditionTreeBranch.build({
              aggregator: 'And',
              conditions: [
                factories.conditionTreeLeaf.build({
                  operator: 'Equal',
                  field: 'aFieldName',
                  value: 'fieldValue',
                }),
              ],
            }),
          });

          const searchCollectionDecorator = new SearchCollectionDecorator(collection, null);

          const refinedFilter = await searchCollectionDecorator.refineFilter(
            factories.caller.build(),
            filter,
          );
          expect(refinedFilter).toEqual({
            search: null,
            conditionTree: {
              aggregator: 'And',
              conditions: [
                { operator: 'Equal', field: 'aFieldName', value: 'fieldValue' },
                { field: 'fieldName', operator: 'IContains', value: 'a text' },
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
                  columnType: 'String',
                  filterOperators: new Set(['IContains', 'Contains']),
                }),
              },
            }),
          });

          const filter = factories.filter.build({ search: 'a text' });

          const searchCollectionDecorator = new SearchCollectionDecorator(collection, null);

          const refinedFilter = await searchCollectionDecorator.refineFilter(
            factories.caller.build(),
            filter,
          );
          expect(refinedFilter).toEqual({
            search: null,
            conditionTree: { field: 'fieldName', operator: 'IContains', value: 'a text' },
          });
        });
      });

      describe('when searching on a string that only supports Equal', () => {
        test('should return filter with "equal" condition', async () => {
          const collection = factories.collection.build({
            schema: factories.collectionSchema.unsearchable().build({
              fields: {
                fieldName: factories.columnSchema.build({
                  columnType: 'String',
                  filterOperators: new Set(['Equal']),
                }),
              },
            }),
          });

          const filter = factories.filter.build({ search: 'a text' });

          const searchCollectionDecorator = new SearchCollectionDecorator(collection, null);

          const refinedFilter = await searchCollectionDecorator.refineFilter(
            factories.caller.build(),
            filter,
          );
          expect(refinedFilter).toEqual({
            search: null,
            conditionTree: { field: 'fieldName', operator: 'Equal', value: 'a text' },
          });
        });
      });

      describe('search is a case insensitive string and both operators are supported', () => {
        test('should return filter with "contains" condition and "or" aggregator', async () => {
          const collection = factories.collection.build({
            schema: factories.collectionSchema.unsearchable().build({
              fields: {
                fieldName: factories.columnSchema.build({
                  columnType: 'String',
                  filterOperators: new Set(['IContains', 'Contains']),
                }),
              },
            }),
          });

          const filter = factories.filter.build({ search: '@#*$(@#*$(23423423' });

          const searchCollectionDecorator = new SearchCollectionDecorator(collection, null);

          const refinedFilter = await searchCollectionDecorator.refineFilter(
            factories.caller.build(),
            filter,
          );
          expect(refinedFilter).toEqual({
            search: null,
            conditionTree: {
              field: 'fieldName',
              operator: 'Contains',
              value: '@#*$(@#*$(23423423',
            },
          });
        });
      });

      describe('when the search is an uuid and the column type is an uuid', () => {
        test('should return filter with "equal" condition and "or" aggregator', async () => {
          const collection = factories.collection.build({
            schema: factories.collectionSchema.unsearchable().build({
              fields: {
                fieldName: factories.columnSchema.build({
                  columnType: 'Uuid',
                  filterOperators: new Set(['Equal']),
                }),
              },
            }),
          });

          const filter = factories.filter.build({ search: '2d162303-78bf-599e-b197-93590ac3d315' });

          const searchCollectionDecorator = new SearchCollectionDecorator(collection, null);

          const refinedFilter = await searchCollectionDecorator.refineFilter(
            factories.caller.build(),
            filter,
          );
          expect(refinedFilter).toEqual({
            search: null,
            conditionTree: {
              field: 'fieldName',
              operator: 'Equal',
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
                  columnType: 'Number',
                  filterOperators: new Set(['Equal']),
                }),
                fieldName2: factories.columnSchema.build({
                  columnType: 'String',
                  filterOperators: new Set(['IContains']),
                }),
              },
            }),
          });

          const filter = factories.filter.build({ search: '1584' });

          const searchCollectionDecorator = new SearchCollectionDecorator(collection, null);

          const refinedFilter = await searchCollectionDecorator.refineFilter(
            factories.caller.build(),
            filter,
          );
          expect(refinedFilter).toEqual({
            search: null,
            conditionTree: {
              aggregator: 'Or',
              conditions: [
                { field: 'fieldName', operator: 'Equal', value: 1584 },
                { field: 'fieldName2', operator: 'IContains', value: '1584' },
              ],
            },
          });
        });
      });

      describe('when the search is an string and the column type is an enum', () => {
        test('should return filter with "equal" condition and "or" aggregator', async () => {
          const collection = factories.collection.build({
            schema: factories.collectionSchema.unsearchable().build({
              fields: {
                fieldName: factories.columnSchema.build({
                  columnType: 'Enum',
                  enumValues: ['AnEnUmVaLue'],
                  filterOperators: new Set(['Equal']),
                }),
              },
            }),
          });

          const filter = factories.filter.build({ search: 'anenumvalue' });

          const searchCollectionDecorator = new SearchCollectionDecorator(collection, null);

          const refinedFilter = await searchCollectionDecorator.refineFilter(
            factories.caller.build(),
            filter,
          );
          expect(refinedFilter).toEqual({
            search: null,
            conditionTree: { field: 'fieldName', operator: 'Equal', value: 'AnEnUmVaLue' },
          });
        });

        describe('when the search value does not match any enum', () => {
          test('adds a condition to not return record if it is the only one filter', async () => {
            const collection = factories.collection.build({
              schema: factories.collectionSchema.unsearchable().build({
                fields: {
                  fieldName: factories.columnSchema.build({
                    columnType: 'Enum',
                    enumValues: ['AEnumValue'],
                  }),
                },
              }),
            });

            const filter = factories.filter.build({ search: 'NotExistEnum' });

            const searchCollectionDecorator = new SearchCollectionDecorator(collection, null);

            const refinedFilter = await searchCollectionDecorator.refineFilter(
              factories.caller.build(),
              filter,
            );
            expect(refinedFilter).toEqual({
              search: null,
              conditionTree: ConditionTreeFactory.MatchNone,
            });
          });
        });

        describe('when the enum values are not defined', () => {
          test('adds a condition to not return record if it is the only one filter', async () => {
            const collection = factories.collection.build({
              schema: factories.collectionSchema.unsearchable().build({
                fields: {
                  fieldName: factories.columnSchema.build({
                    columnType: 'Enum',
                    // enum values is not defined
                  }),
                },
              }),
            });

            const filter = factories.filter.build({ search: 'NotExistEnum' });

            const searchCollectionDecorator = new SearchCollectionDecorator(collection, null);

            const refinedFilter = await searchCollectionDecorator.refineFilter(
              factories.caller.build(),
              filter,
            );
            expect(refinedFilter).toEqual({
              search: null,
              conditionTree: ConditionTreeFactory.MatchNone,
            });
          });
        });

        describe('when the column type is not searchable', () => {
          test('adds a condition to not return record if it is the only one filter', async () => {
            const collection = factories.collection.build({
              schema: factories.collectionSchema.unsearchable().build({
                fields: {
                  fieldName: factories.columnSchema.build({ columnType: 'Boolean' }),
                  originKey: factories.columnSchema.build({
                    columnType: 'String',
                    filterOperators: null,
                  }),
                },
              }),
            });

            const filter = factories.filter.build({ search: '1584' });

            const searchCollectionDecorator = new SearchCollectionDecorator(collection, null);

            const refinedFilter = await searchCollectionDecorator.refineFilter(
              factories.caller.build(),
              filter,
            );
            expect(refinedFilter).toEqual({
              search: null,
              conditionTree: ConditionTreeFactory.MatchNone,
            });
          });
        });
      });

      describe('when there are several fields', () => {
        test('should return all the number fields when a number is researched', async () => {
          const collection = factories.collection.build({
            schema: factories.collectionSchema.unsearchable().build({
              fields: {
                numberField1: factories.columnSchema.build({
                  columnType: 'Number',
                  filterOperators: new Set(['Equal']),
                }),
                numberField2: factories.columnSchema.build({
                  columnType: 'Number',
                  filterOperators: new Set(['Equal']),
                }),
                fieldNotReturned: factories.columnSchema.build({ columnType: 'Uuid' }),
              },
            }),
          });

          const filter = factories.filter.build({ search: '1584' });

          const searchCollectionDecorator = new SearchCollectionDecorator(collection, null);

          const refinedFilter = await searchCollectionDecorator.refineFilter(
            factories.caller.build(),
            filter,
          );
          expect(refinedFilter).toEqual({
            search: null,
            conditionTree: {
              aggregator: 'Or',
              conditions: [
                { field: 'numberField1', operator: 'Equal', value: 1584 },
                { field: 'numberField2', operator: 'Equal', value: 1584 },
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
                    id: factories.columnSchema.uuidPrimaryKey().build(),
                    myPersons: factories.oneToOneSchema.build({
                      foreignCollection: 'persons',
                      originKey: 'personId',
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
                    bookId: factories.columnSchema.uuidPrimaryKey().build(),
                    personId: factories.columnSchema.uuidPrimaryKey().build(),
                  },
                }),
              }),
              factories.collection.build({
                name: 'persons',
                schema: factories.collectionSchema.unsearchable().build({
                  fields: {
                    id: factories.columnSchema.uuidPrimaryKey().build(),
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

            const refinedFilter = await searchCollectionDecorator.refineFilter(
              factories.caller.build(),
              filter,
            );
            expect(refinedFilter).toEqual({
              searchExtended: true,
              search: null,
              conditionTree: {
                aggregator: 'Or',
                conditions: [
                  { field: 'id', operator: 'Equal', value: '2d162303-78bf-599e-b197-93590ac3d315' },
                  {
                    field: 'myPersons:id',
                    operator: 'Equal',
                    value: '2d162303-78bf-599e-b197-93590ac3d315',
                  },
                  {
                    field: 'myBookPersons:bookId',
                    operator: 'Equal',
                    value: '2d162303-78bf-599e-b197-93590ac3d315',
                  },
                  {
                    field: 'myBookPersons:personId',
                    operator: 'Equal',
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
