import { createMockContext } from '@shopify/jest-koa-mocks';

import DeleteRoute from '../../../src/routes/modification/delete';
import { HttpCode } from '../../../src/types';
import * as factories from '../../__factories__';

describe('DeleteRoute', () => {
  const options = factories.forestAdminHttpDriverOptions.build();
  const services = factories.forestAdminHttpDriverServices.build();
  const router = factories.router.mockAllMethods().build();

  test('should register "/books" route', () => {
    const bookCollection = factories.collection.build({ name: 'books' });
    const dataSource = factories.dataSource.buildWithCollections([bookCollection]);
    const deleteRoute = new DeleteRoute(services, options, dataSource, 'books');

    deleteRoute.setupRoutes(router);

    expect(router.delete).toHaveBeenCalledWith('/books', expect.any(Function));
    expect(router.delete).toHaveBeenCalledWith('/books/:id', expect.any(Function));
  });

  describe('handleDelete', () => {
    describe('when the given id is a composite id', () => {
      test('should generate the filter to delete the right records', async () => {
        const bookCollection = factories.collection.build({
          name: 'books',
          schema: factories.collectionSchema.build({
            fields: {
              idField1: factories.columnSchema.numericPrimaryKey().build(),
              idField2: factories.columnSchema.numericPrimaryKey().build(),
              notIdField: factories.columnSchema.build({
                columnType: 'Number',
              }),
            },
          }),
        });
        const dataSource = factories.dataSource.buildWithCollection(bookCollection);
        const deleteRoute = new DeleteRoute(services, options, dataSource, 'books');

        const context = createMockContext({
          state: { user: { email: 'john.doe@domain.com' } },
          customProperties: {
            params: { id: '1523|1524' },
            query: { timezone: 'Europe/Paris' },
          },
        });
        await deleteRoute.handleDelete(context);

        expect(bookCollection.delete).toHaveBeenCalledWith(
          { email: 'john.doe@domain.com', timezone: 'Europe/Paris' },
          factories.filter.build({
            conditionTree: factories.conditionTreeBranch.build({
              aggregator: 'And',
              conditions: [
                factories.conditionTreeLeaf.build({
                  operator: 'Equal',
                  value: 1523,
                  field: 'idField1',
                }),
                factories.conditionTreeLeaf.build({
                  operator: 'Equal',
                  value: 1524,
                  field: 'idField2',
                }),
              ],
            }),
            search: null,
            searchExtended: false,
            segment: null,
          }),
        );
      });

      test('it should apply the scope', async () => {
        const bookCollection = factories.collection.build({
          name: 'books',
          schema: factories.collectionSchema.build({
            fields: {
              idField1: factories.columnSchema.numericPrimaryKey().build({
                columnType: 'Number',
              }),
              idField2: factories.columnSchema.numericPrimaryKey().build({
                columnType: 'Number',
              }),
              notIdField: factories.columnSchema.build({
                columnType: 'Number',
              }),
            },
          }),
        });
        const dataSource = factories.dataSource.buildWithCollection(bookCollection);
        const deleteRoute = new DeleteRoute(services, options, dataSource, 'books');

        const context = createMockContext({
          state: { user: { email: 'john.doe@domain.com' } },
          customProperties: {
            params: { id: '1523|1524' },
            query: { timezone: 'Europe/Paris' },
          },
        });

        const getScopeMock = services.authorization.getScope as jest.Mock;
        getScopeMock.mockResolvedValueOnce({
          field: 'title',
          operator: 'NotContains',
          value: '[test]',
        });

        await deleteRoute.handleDelete(context);

        expect(bookCollection.delete).toHaveBeenCalledWith(
          { email: 'john.doe@domain.com', timezone: 'Europe/Paris' },
          factories.filter.build({
            conditionTree: factories.conditionTreeBranch.build({
              aggregator: 'And',
              conditions: [
                factories.conditionTreeLeaf.build({
                  operator: 'NotContains',
                  value: '[test]',
                  field: 'title',
                }),
                factories.conditionTreeLeaf.build({
                  operator: 'Equal',
                  value: 1523,
                  field: 'idField1',
                }),
                factories.conditionTreeLeaf.build({
                  operator: 'Equal',
                  value: 1524,
                  field: 'idField2',
                }),
              ],
            }),
            search: null,
            searchExtended: false,
            segment: null,
          }),
        );
      });
    });

    describe('when the given id is a simple id', () => {
      function setup() {
        const bookCollection = factories.collection.build({
          name: 'books',
          schema: factories.collectionSchema.build({
            fields: {
              id: factories.columnSchema.numericPrimaryKey().build(),
            },
          }),
        });
        const dataSource = factories.dataSource.buildWithCollection(bookCollection);
        const deleteRoute = new DeleteRoute(services, options, dataSource, 'books');

        const context = createMockContext({
          state: { user: { email: 'john.doe@domain.com' } },
          customProperties: {
            params: { id: '1523' },
            query: { timezone: 'Europe/Paris' },
          },
        });

        return { context, deleteRoute, bookCollection };
      }

      test('should generate the filter to delete the right record', async () => {
        const { context, deleteRoute, bookCollection } = setup();

        await deleteRoute.handleDelete(context);

        expect(bookCollection.delete).toHaveBeenCalledWith(
          { email: 'john.doe@domain.com', timezone: 'Europe/Paris' },
          factories.filter.build({
            conditionTree: factories.conditionTreeLeaf.build({
              operator: 'Equal',
              value: 1523,
              field: 'id',
            }),
            search: null,
            searchExtended: false,
            segment: null,
          }),
        );
        expect(context.response.status).toEqual(HttpCode.NoContent);
      });

      test('should check that the user is authorized to delete elements', async () => {
        const { context, deleteRoute } = setup();

        await deleteRoute.handleDelete(context);

        expect(services.authorization.assertCanDelete).toHaveBeenCalledWith(context, 'books');
      });
    });
  });

  describe('handleListDelete', () => {
    describe('when the given ids are simples ids', () => {
      test('should generate the filter to delete the right records', async () => {
        const bookCollection = factories.collection.build({
          name: 'books',
          schema: factories.collectionSchema.build({
            fields: {
              id: factories.columnSchema.numericPrimaryKey().build(),
            },
          }),
        });
        const dataSource = factories.dataSource.buildWithCollection(bookCollection);
        const deleteRoute = new DeleteRoute(services, options, dataSource, 'books');

        const context = createMockContext({
          state: { user: { email: 'john.doe@domain.com' } },
          customProperties: { query: { timezone: 'Europe/Paris' } },
          requestBody: {
            data: {
              attributes: { ids: ['1523', '5684'], all_records: false },
            },
          },
        });
        await deleteRoute.handleListDelete(context);

        expect(bookCollection.delete).toHaveBeenCalledWith(
          { email: 'john.doe@domain.com', timezone: 'Europe/Paris' },
          factories.filter.build({
            conditionTree: factories.conditionTreeLeaf.build({
              operator: 'In',
              value: [1523, 5684],
              field: 'id',
            }),
            search: null,
            searchExtended: false,
            segment: null,
          }),
        );
        expect(context.response.status).toEqual(HttpCode.NoContent);
      });

      describe('with excluded mode', () => {
        test('should generate the filter to delete the right records', async () => {
          const bookCollection = factories.collection.build({
            name: 'books',
            schema: factories.collectionSchema.build({
              fields: {
                id: factories.columnSchema.numericPrimaryKey().build(),
              },
            }),
          });
          const dataSource = factories.dataSource.buildWithCollection(bookCollection);
          const deleteRoute = new DeleteRoute(services, options, dataSource, 'books');

          const context = createMockContext({
            state: { user: { email: 'john.doe@domain.com' } },
            customProperties: { query: { timezone: 'Europe/Paris' } },
            requestBody: {
              data: {
                // excluded mode
                attributes: {
                  ids: ['1523', '5684'],
                  all_records: true,
                  all_records_ids_excluded: ['1523'],
                },
              },
            },
          });
          await deleteRoute.handleListDelete(context);

          expect(bookCollection.delete).toHaveBeenCalledWith(
            { email: 'john.doe@domain.com', timezone: 'Europe/Paris' },
            factories.filter.build({
              conditionTree: factories.conditionTreeLeaf.build({
                operator: 'NotEqual',
                value: 1523,
                field: 'id',
              }),
              search: null,
              searchExtended: false,
              segment: null,
            }),
          );
          expect(context.response.status).toEqual(HttpCode.NoContent);
        });
      });
    });

    describe('with the given ids are composites ids', () => {
      test('should generate the filter to delete the right records', async () => {
        const bookCollection = factories.collection.build({
          name: 'books',
          schema: factories.collectionSchema.build({
            fields: {
              idField1: factories.columnSchema.numericPrimaryKey().build(),
              idField2: factories.columnSchema.numericPrimaryKey().build(),
              notIdField: factories.columnSchema.build({
                columnType: 'Number',
              }),
            },
          }),
        });
        const dataSource = factories.dataSource.buildWithCollection(bookCollection);
        const deleteRoute = new DeleteRoute(services, options, dataSource, 'books');

        const context = createMockContext({
          state: { user: { email: 'john.doe@domain.com' } },
          customProperties: { query: { timezone: 'Europe/Paris' } },
          requestBody: {
            data: {
              attributes: { ids: ['1523|1524', '1523|5688', '9999|7894'], all_records: false },
            },
          },
        });
        await deleteRoute.handleListDelete(context);

        expect(bookCollection.delete).toHaveBeenCalledWith(
          { email: 'john.doe@domain.com', timezone: 'Europe/Paris' },
          factories.filter.build({
            conditionTree: factories.conditionTreeBranch.build({
              aggregator: 'Or',
              conditions: [
                factories.conditionTreeBranch.build({
                  aggregator: 'And',
                  conditions: [
                    factories.conditionTreeLeaf.build({
                      operator: 'Equal',
                      value: 1523,
                      field: 'idField1',
                    }),
                    factories.conditionTreeLeaf.build({
                      operator: 'In',
                      value: [1524, 5688],
                      field: 'idField2',
                    }),
                  ],
                }),
                factories.conditionTreeBranch.build({
                  aggregator: 'And',
                  conditions: [
                    factories.conditionTreeLeaf.build({
                      operator: 'Equal',
                      value: 9999,
                      field: 'idField1',
                    }),
                    factories.conditionTreeLeaf.build({
                      operator: 'Equal',
                      value: 7894,
                      field: 'idField2',
                    }),
                  ],
                }),
              ],
            }),
            search: null,
            searchExtended: false,
            segment: null,
          }),
        );
      });

      describe('with excluded mode', () => {
        test('should generate the filter to delete the right records', async () => {
          const bookCollection = factories.collection.build({
            name: 'books',
            schema: factories.collectionSchema.build({
              fields: {
                idField1: factories.columnSchema.numericPrimaryKey().build(),
                idField2: factories.columnSchema.numericPrimaryKey().build(),
                notIdField: factories.columnSchema.build({
                  columnType: 'Number',
                }),
              },
            }),
          });
          const dataSource = factories.dataSource.buildWithCollection(bookCollection);
          const deleteRoute = new DeleteRoute(services, options, dataSource, 'books');

          const context = createMockContext({
            state: { user: { email: 'john.doe@domain.com' } },
            customProperties: { query: { timezone: 'Europe/Paris' } },
            requestBody: {
              data: {
                attributes: {
                  ids: ['1523|1524', '1523|5688', '9999|7894'],
                  // excluded mode
                  all_records: true,
                  all_records_ids_excluded: ['1523|1524', '1523|5688'],
                },
              },
            },
          });
          await deleteRoute.handleListDelete(context);

          expect(bookCollection.delete).toHaveBeenCalledWith(
            { email: 'john.doe@domain.com', timezone: 'Europe/Paris' },
            factories.filter.build({
              conditionTree: factories.conditionTreeBranch.build({
                aggregator: 'Or',
                conditions: [
                  factories.conditionTreeLeaf.build({
                    operator: 'NotEqual',
                    value: 1523,
                    field: 'idField1',
                  }),
                  factories.conditionTreeLeaf.build({
                    operator: 'NotIn',
                    value: [1524, 5688],
                    field: 'idField2',
                  }),
                ],
              }),
              search: null,
              searchExtended: false,
              segment: null,
            }),
          );
        });
      });
    });
  });
});
