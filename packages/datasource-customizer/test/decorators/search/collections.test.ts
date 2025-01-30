import {
  Collection,
  CollectionSchema,
  ConditionTreeFactory,
  ConditionTreeLeaf,
  DataSourceDecorator,
  PaginatedFilter,
} from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import SearchCollectionDecorator from '../../../src/decorators/search/collection';

const caller = factories.caller.build();

function buildCollection(
  schema: Partial<CollectionSchema>,
  otherCollections: Collection[] = [],
): SearchCollectionDecorator {
  const dataSource = factories.dataSource.buildWithCollections([
    factories.collection.build({
      schema: factories.collectionSchema.unsearchable().build(schema),
    }),
    ...otherCollections,
  ]);

  const decoratedDataSource = new DataSourceDecorator(dataSource, SearchCollectionDecorator);

  return decoratedDataSource.collections[0];
}

describe('SearchCollectionDecorator', () => {
  describe('disable', () => {
    it('should set the schema to isSearchable false', async () => {
      const decorator = buildCollection({});
      decorator.disable();

      expect(decorator.schema.searchable).toBe(false);
    });
  });

  describe('refineSchema', () => {
    it('should set the schema searchable', async () => {
      const decorator = buildCollection({ searchable: false });

      expect(decorator.schema.searchable).toBe(true);
    });

    describe('when replace and disable are both used', () => {
      it('should set the schema searchable', async () => {
        const decorator = buildCollection({});
        decorator.disable();

        expect(decorator.schema.searchable).toBe(false);

        decorator.replaceSearch(value => ({ field: 'id', operator: 'Equal', value }));

        expect(decorator.schema.searchable).toBe(true);
      });

      it('should set the schema not searchable', async () => {
        const decorator = buildCollection({});
        decorator.replaceSearch(value => ({ field: 'id', operator: 'Equal', value }));

        expect(decorator.schema.searchable).toBe(true);

        decorator.disable();

        expect(decorator.schema.searchable).toBe(false);
      });
    });
  });

  describe('refineFilter', () => {
    describe('when the search value is null', () => {
      test('should return the given filter to return all records', async () => {
        const decorator = buildCollection({});
        const filter = factories.filter.build({ search: null as unknown as undefined });

        expect(await decorator.refineFilter(caller, filter)).toStrictEqual(filter);
      });
    });

    describe('when the given field is not a column', () => {
      test('adds a condition to not return record if it is the only one filter', async () => {
        const decorator = buildCollection({
          fields: { fieldName: factories.oneToManySchema.build() },
        });

        const filter = factories.filter.build({ search: 'a search value' });

        expect(await decorator.refineFilter(caller, filter)).toEqual({
          search: null,
          conditionTree: ConditionTreeFactory.MatchNone,
        });
      });
    });

    describe('when the collection schema is searchable', () => {
      test('should return the given filter without adding condition', async () => {
        const decorator = buildCollection({ searchable: true });

        const filter = factories.filter.build({ search: 'a text' });

        expect(await decorator.refineFilter(caller, filter)).toStrictEqual(filter);
      });
    });

    describe('when a replacer is provided', () => {
      test('it should be used instead of the default one', async () => {
        const decorator = buildCollection({
          fields: { id: factories.columnSchema.uuidPrimaryKey().build() },
        });
        decorator.replaceSearch(value => ({ field: 'id', operator: 'Equal', value }));

        const filter = factories.filter.build({ search: 'something' });

        expect(await decorator.refineFilter(caller, filter)).toEqual({
          ...filter,
          conditionTree: new ConditionTreeLeaf('id', 'Equal', 'something'),
          search: null,
        });
      });

      test('it should allow to use the default search with options', async () => {
        const decorator = buildCollection({
          fields: {
            id: factories.columnSchema.uuidPrimaryKey().build(),
            name: factories.columnSchema.text().build(),
            description: factories.columnSchema.text().build(),
          },
        });

        decorator.replaceSearch((value, _extended, ctx) => {
          return ctx.generateSearchFilter(value, { excludeFields: ['name'] });
        });

        const filter = factories.filter.build({ search: 'something', searchExtended: true });

        expect(await decorator.refineFilter(caller, filter)).toEqual({
          ...filter,
          conditionTree: new ConditionTreeLeaf('description', 'IContains', 'something'),
          search: null,
        });
      });
    });

    describe('when the search is defined and the collection schema is not searchable', () => {
      describe('when the search is empty', () => {
        test('returns the same filter and set search as null', async () => {
          const decorator = buildCollection(factories.collectionSchema.unsearchable().build());
          const filter = factories.filter.build({ search: '     ' });

          expect(await decorator.refineFilter(caller, filter)).toEqual({
            ...filter,
            search: null,
          });
        });
      });

      describe('when the filter contains already conditions', () => {
        test('should add its conditions to the filter', async () => {
          const decorator = buildCollection({
            fields: {
              fieldName: factories.columnSchema.build({
                columnType: 'String',
                filterOperators: new Set(['IContains']),
              }),
            },
          });

          const filter = factories.filter.build({
            search: '"a text"',
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

          expect(await decorator.refineFilter(caller, filter)).toEqual({
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

      describe('when using bad column indication', () => {
        test('should behave as if it was not a column indication', async () => {
          const decorator = buildCollection({
            fields: {
              fieldName: factories.columnSchema.build({
                columnType: 'String',
                filterOperators: new Set(['IContains', 'Contains']),
              }),
            },
          });

          const filter = factories.filter.build({ search: 'noexist:atext' });

          expect(await decorator.refineFilter(caller, filter)).toEqual({
            search: null,
            conditionTree: { field: 'fieldName', operator: 'IContains', value: 'noexist:atext' },
          });
        });
      });

      describe('when mixing indications and normal text', () => {
        test('should mix and & or', async () => {
          const decorator = buildCollection({
            fields: {
              fieldName1: factories.columnSchema.build({
                columnType: 'String',
                filterOperators: new Set(['IContains', 'Contains']),
              }),
              fieldName2: factories.columnSchema.build({
                columnType: 'String',
                filterOperators: new Set(['IContains', 'Contains']),
              }),
              fieldName3: factories.columnSchema.build({
                columnType: 'String',
                filterOperators: new Set(['IContains', 'Contains', 'NotContains']),
              }),
            },
          });

          const filter = factories.filter.build({
            search: 'fieldname1:atext -fieldname3:something "extra keywords"',
          });

          expect(await decorator.refineFilter(caller, filter)).toEqual({
            search: null,
            conditionTree: {
              aggregator: 'And',
              conditions: [
                { field: 'fieldName1', operator: 'IContains', value: 'atext' },
                { field: 'fieldName3', operator: 'NotContains', value: 'something' },
                {
                  aggregator: 'Or',
                  conditions: [
                    { field: 'fieldName1', operator: 'IContains', value: 'extra keywords' },
                    { field: 'fieldName2', operator: 'IContains', value: 'extra keywords' },
                    { field: 'fieldName3', operator: 'IContains', value: 'extra keywords' },
                  ],
                },
              ],
            },
          });
        });
      });

      describe('when using column indication on unsupported field', () => {
        test('should behave as if it was not a column indication', async () => {
          const decorator = buildCollection({
            fields: {
              fieldName: factories.columnSchema.build({
                columnType: 'String',
                filterOperators: new Set(),
              }),
            },
          });

          const filter = factories.filter.build({ search: 'fieldName:atext' });

          expect(await decorator.refineFilter(caller, filter)).toEqual({
            search: null,
            conditionTree: ConditionTreeFactory.MatchNone,
          });
        });
      });

      describe('when using boolean search', () => {
        test('should return filter with "Equal"', async () => {
          const decorator = buildCollection({
            fields: {
              fieldName: factories.columnSchema.build({
                columnType: 'Boolean',
                filterOperators: new Set(['Equal']),
              }),
            },
          });

          const filter = factories.filter.build({ search: 'fieldname:true' });

          expect(await decorator.refineFilter(caller, filter)).toEqual({
            search: null,
            conditionTree: { field: 'fieldName', operator: 'Equal', value: true },
          });
        });
      });

      describe('when using negated equal to null', () => {
        test('should return filter with "Present"', async () => {
          const decorator = buildCollection({
            fields: {
              fieldName: factories.columnSchema.build({
                columnType: 'String',
                filterOperators: new Set(['Present']),
              }),
            },
          });

          const filter = factories.filter.build({ search: '-fielDnAme:NULL' });

          expect(await decorator.refineFilter(caller, filter)).toEqual({
            search: null,
            conditionTree: { field: 'fieldName', operator: 'Present' },
          });
        });
      });

      describe('when using "equal null"', () => {
        test('should return filter with "Missing"', async () => {
          const decorator = buildCollection({
            fields: {
              fieldName: factories.columnSchema.build({
                columnType: 'String',
                filterOperators: new Set(['Missing']),
              }),
            },
          });

          const filter = factories.filter.build({ search: 'fielDnAme:NULL' });

          expect(await decorator.refineFilter(caller, filter)).toEqual({
            search: null,
            conditionTree: { field: 'fieldName', operator: 'Missing' },
          });
        });
      });

      describe('when using negated keyword', () => {
        test('should return filter with "notcontains"', async () => {
          const decorator = buildCollection({
            fields: {
              fieldName: factories.columnSchema.build({
                columnType: 'String',
                filterOperators: new Set(['NotContains']),
              }),
              fieldName2: factories.columnSchema.build({
                columnType: 'String',
                filterOperators: new Set(['NotContains']),
              }),
            },
          });

          const filter = factories.filter.build({ search: '-atext' });

          expect(await decorator.refineFilter(caller, filter)).toEqual({
            search: null,
            conditionTree: {
              aggregator: 'And',
              conditions: [
                { field: 'fieldName', operator: 'NotContains', value: 'atext' },
                { field: 'fieldName2', operator: 'NotContains', value: 'atext' },
              ],
            },
          });
        });
      });

      describe('when using negated column indication', () => {
        test('should return filter with "notcontains"', async () => {
          const decorator = buildCollection({
            fields: {
              fieldName: factories.columnSchema.build({
                columnType: 'String',
                filterOperators: new Set(['NotContains']),
              }),
            },
          });

          const filter = factories.filter.build({ search: '-fieldname:atext' });
          const refined = await decorator.refineFilter(caller, filter);

          expect(refined).toEqual({
            search: null,
            conditionTree: { field: 'fieldName', operator: 'NotContains', value: 'atext' },
          });
        });
      });

      describe('when the search is a string and the column type is a string', () => {
        test('should return filter with "contains" condition and "or" aggregator', async () => {
          const decorator = buildCollection({
            fields: {
              fieldName: factories.columnSchema.build({
                columnType: 'String',
                filterOperators: new Set(['IContains', 'Contains']),
              }),
            },
          });

          const filter = factories.filter.build({ search: 'text' });

          expect(await decorator.refineFilter(caller, filter)).toEqual({
            search: null,
            conditionTree: { field: 'fieldName', operator: 'IContains', value: 'text' },
          });
        });
      });

      describe('when searching on a string that only supports Equal', () => {
        test('should return filter with "equal" condition', async () => {
          const decorator = buildCollection({
            fields: {
              fieldName: factories.columnSchema.build({
                columnType: 'String',
                filterOperators: new Set(['Equal']),
              }),
            },
          });

          const filter = factories.filter.build({ search: 'text' });

          expect(await decorator.refineFilter(caller, filter)).toEqual({
            search: null,
            conditionTree: { field: 'fieldName', operator: 'Equal', value: 'text' },
          });
        });
      });

      describe('when the search is an uuid and the column type is an uuid', () => {
        test('should return filter with "equal" condition and "or" aggregator', async () => {
          const decorator = buildCollection({
            fields: {
              fieldName: factories.columnSchema.build({
                columnType: 'Uuid',
                filterOperators: new Set(['Equal']),
              }),
            },
          });

          const filter = factories.filter.build({ search: '2d162303-78bf-599e-b197-93590ac3d315' });

          expect(await decorator.refineFilter(caller, filter)).toEqual({
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
          const decorator = buildCollection({
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
          });

          const filter = factories.filter.build({ search: '1584' });

          expect(await decorator.refineFilter(caller, filter)).toEqual({
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
          const decorator = buildCollection({
            fields: {
              fieldName: factories.columnSchema.build({
                columnType: 'Enum',
                enumValues: ['AnEnUmVaLue'],
                filterOperators: new Set(['Equal']),
              }),
            },
          });

          const filter = factories.filter.build({ search: 'anenumvalue' });

          expect(await decorator.refineFilter(caller, filter)).toEqual({
            search: null,
            conditionTree: { field: 'fieldName', operator: 'Equal', value: 'AnEnUmVaLue' },
          });
        });

        describe('when the search value does not match any enum', () => {
          test('adds a condition to not return record if it is the only one filter', async () => {
            const decorator = buildCollection({
              fields: {
                fieldName: factories.columnSchema.build({
                  columnType: 'Enum',
                  enumValues: ['AEnumValue'],
                }),
              },
            });

            const filter = factories.filter.build({ search: 'NotExistEnum' });

            expect(await decorator.refineFilter(caller, filter)).toEqual({
              search: null,
              conditionTree: ConditionTreeFactory.MatchNone,
            });
          });
        });

        describe('when the enum values are not defined', () => {
          test('adds a condition to not return record if it is the only one filter', async () => {
            // enum values is not defined
            const decorator = buildCollection({
              fields: { fieldName: factories.columnSchema.build({ columnType: 'Enum' }) },
            });

            const filter = factories.filter.build({ search: 'NotExistEnum' });

            expect(await decorator.refineFilter(caller, filter)).toEqual({
              search: null,
              conditionTree: ConditionTreeFactory.MatchNone,
            });
          });
        });

        describe('when the column type is not searchable', () => {
          test('adds a condition to not return record if it is the only one filter', async () => {
            const decorator = buildCollection({
              fields: {
                fieldName: factories.columnSchema.build({ columnType: 'Boolean' }),
                originKey: factories.columnSchema.build({
                  columnType: 'String',
                  filterOperators: new Set(),
                }),
              },
            });

            const filter = factories.filter.build({ search: '1584' });

            expect(await decorator.refineFilter(caller, filter)).toEqual({
              search: null,
              conditionTree: ConditionTreeFactory.MatchNone,
            });
          });
        });
      });

      describe('when there are several fields', () => {
        test('should return all the number fields when a number is researched', async () => {
          const decorator = buildCollection({
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
          });

          const filter = factories.filter.build({ search: '1584' });

          expect(await decorator.refineFilter(caller, filter)).toEqual({
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

        describe('when using deep column indication', () => {
          test('should return filter with "contains" condition and "or" aggregator', async () => {
            const decorator = buildCollection(
              {
                fields: {
                  id: factories.columnSchema.uuidPrimaryKey().build(),
                  userId: factories.columnSchema.build(),
                  Rela_tioN: factories.manyToOneSchema.build({
                    foreignCollection: 'users',
                    foreignKey: 'userId',
                    foreignKeyTarget: 'id',
                  }),
                },
              },
              [
                factories.collection.build({
                  name: 'users',
                  schema: factories.collectionSchema.build({
                    fields: {
                      id: factories.columnSchema.uuidPrimaryKey().build(),
                      nAME: factories.columnSchema.build({
                        columnType: 'String',
                        filterOperators: new Set(['IContains']),
                      }),
                    },
                  }),
                }),
              ],
            );

            const filter = factories.filter.build({ search: 'relation.name:atext' });

            expect(await decorator.refineFilter(caller, filter)).toEqual({
              search: null,
              conditionTree: { field: 'Rela_tioN:nAME', operator: 'IContains', value: 'atext' },
            });
          });
        });

        describe('when using invalid deep column indication', () => {
          test('should do as if it was not an indication', async () => {
            const decorator = buildCollection(
              {
                fields: {
                  id: factories.columnSchema.uuidPrimaryKey().build(),
                  Rela_tioN: factories.oneToManySchema.build({
                    foreignCollection: 'users',
                    originKey: 'userId',
                    originKeyTarget: 'id',
                  }),
                },
              },
              [
                factories.collection.build({
                  name: 'users',
                  schema: factories.collectionSchema.build({
                    fields: {
                      id: factories.columnSchema.uuidPrimaryKey().build(),
                      bookId: factories.columnSchema.build(),
                      nAME: factories.columnSchema.build({
                        columnType: 'String',
                        filterOperators: new Set(['IContains']),
                      }),
                    },
                  }),
                }),
              ],
            );

            const filter = factories.filter.build({ search: 'relation.name:atext' });

            expect(await decorator.refineFilter(caller, filter)).toEqual(
              new PaginatedFilter({
                conditionTree: ConditionTreeFactory.fromPlainObject({
                  field: 'Rela_tioN:nAME',
                  operator: 'IContains',
                  value: 'atext',
                }),
                search: null,
              }),
            );
          });
        });

        describe('when it is a deep search with relation fields', () => {
          test('should return all the uuid fields when uuid is researched', async () => {
            const decorator = buildCollection(
              {
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
              },
              [
                factories.collection.build({
                  name: 'bookPersons',
                  schema: factories.collectionSchema.build({
                    fields: {
                      bookId: factories.columnSchema.uuidPrimaryKey().build(),
                      personId: factories.columnSchema.uuidPrimaryKey().build(),
                    },
                  }),
                }),
                factories.collection.build({
                  name: 'persons',
                  schema: factories.collectionSchema.build({
                    fields: {
                      id: factories.columnSchema.uuidPrimaryKey().build(),
                    },
                  }),
                }),
              ],
            );

            const filter = factories.filter.build({
              searchExtended: true,
              search: '2d162303-78bf-599e-b197-93590ac3d315',
            });

            expect(await decorator.refineFilter(caller, filter)).toEqual({
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
