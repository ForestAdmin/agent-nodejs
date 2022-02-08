import { createMockContext } from '@shopify/jest-koa-mocks';
import { Aggregator, Operator, PrimitiveTypes } from '@forestadmin/datasource-toolkit';
import DeleteRoute from '../../../src/routes/modification/delete';
import * as factories from '../../__factories__';
import { HttpCode } from '../../../src/types';

describe('DeleteRoute', () => {
  const options = factories.forestAdminHttpDriverOptions.build();
  const services = factories.forestAdminHttpDriverServices.build();
  const router = factories.router.mockAllMethods().build();

  test('should register "/books" private routes', () => {
    const bookCollection = factories.collection.build({ name: 'books' });
    const dataSource = factories.dataSource.buildWithCollections([bookCollection]);
    const deleteRoute = new DeleteRoute(services, options, dataSource, 'books');

    deleteRoute.setupPrivateRoutes(router);

    expect(router.delete).toHaveBeenCalledWith('/books', expect.any(Function));
    expect(router.delete).toHaveBeenCalledWith('/books/:id', expect.any(Function));
  });

  describe('handleDelete', () => {
    test('should throw an error when the id attribute is not provided', async () => {
      const bookCollection = factories.collection.build({ name: 'books' });
      const dataSource = factories.dataSource.buildWithCollection(bookCollection);
      const deleteRoute = new DeleteRoute(services, options, dataSource, 'books');

      const context = createMockContext({
        customProperties: {
          params: { badParam: '1523|1524' },
          query: { timezone: 'Europe/Paris' },
        },
      });

      await deleteRoute.handleDelete(context);

      expect(context.throw).toHaveBeenCalledWith(HttpCode.BadRequest, expect.any(String));
    });

    test('should throw an error when the delete action failed', async () => {
      const bookCollection = factories.collection.build({
        name: 'books',
        delete: jest.fn().mockImplementation(() => {
          throw new Error('an error');
        }),
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.isPrimaryKey().build(),
          },
        }),
      });
      const dataSource = factories.dataSource.buildWithCollection(bookCollection);
      const deleteRoute = new DeleteRoute(services, options, dataSource, 'books');

      const context = createMockContext({
        customProperties: {
          params: { id: '1523' },
          query: { timezone: 'Europe/Paris' },
        },
      });
      await deleteRoute.handleDelete(context);

      expect(context.throw).toHaveBeenCalledWith(HttpCode.InternalServerError, expect.any(String));
    });

    describe('when the given id is a composite id', () => {
      test('should generate the filter to delete the right records', async () => {
        const bookCollection = factories.collection.build({
          name: 'books',
          schema: factories.collectionSchema.build({
            fields: {
              idField1: factories.columnSchema.isPrimaryKey().build({
                columnType: PrimitiveTypes.Number,
              }),
              idField2: factories.columnSchema.isPrimaryKey().build({
                columnType: PrimitiveTypes.Number,
              }),
              notIdField: factories.columnSchema.build({
                columnType: PrimitiveTypes.Number,
              }),
            },
          }),
        });
        const dataSource = factories.dataSource.buildWithCollection(bookCollection);
        const deleteRoute = new DeleteRoute(services, options, dataSource, 'books');

        const context = createMockContext({
          customProperties: {
            params: { id: '1523|1524' },
            query: { timezone: 'Europe/Paris' },
          },
        });
        await deleteRoute.handleDelete(context);

        expect(context.throw).not.toHaveBeenCalled();
        expect(bookCollection.delete).toHaveBeenCalledWith(
          factories.filter.build({
            conditionTree: factories.conditionTreeBranch.build({
              aggregator: Aggregator.And,
              conditions: [
                factories.conditionTreeLeaf.build({
                  operator: Operator.Equal,
                  value: 1523,
                  field: 'idField1',
                }),
                factories.conditionTreeLeaf.build({
                  operator: Operator.Equal,
                  value: 1524,
                  field: 'idField2',
                }),
              ],
            }),
            segment: null,
            timezone: 'Europe/Paris',
          }),
        );
      });
    });

    describe('when the given id is a simple id', () => {
      test('should generate the filter to delete the right record', async () => {
        const bookCollection = factories.collection.build({
          name: 'books',
          schema: factories.collectionSchema.build({
            fields: {
              id: factories.columnSchema.isPrimaryKey().build({
                columnType: PrimitiveTypes.Number,
              }),
            },
          }),
        });
        const dataSource = factories.dataSource.buildWithCollection(bookCollection);
        const deleteRoute = new DeleteRoute(services, options, dataSource, 'books');

        const context = createMockContext({
          customProperties: {
            params: { id: '1523' },
            query: { timezone: 'Europe/Paris' },
          },
        });
        await deleteRoute.handleDelete(context);

        expect(context.throw).not.toHaveBeenCalled();
        expect(bookCollection.delete).toHaveBeenCalledWith(
          factories.filter.build({
            conditionTree: factories.conditionTreeLeaf.build({
              operator: Operator.Equal,
              value: 1523,
              field: 'id',
            }),
            segment: null,
            timezone: 'Europe/Paris',
          }),
        );
        expect(context.response.status).toEqual(HttpCode.NoContent);
      });
    });
  });

  describe('handleListDelete', () => {
    describe('when some attributes are badly provided', () => {
      test.each([
        ['no body is provided', null, 'Expected array, received: undefined'],
        [
          'body does not contains data',
          { datum: 'something' },
          'Expected array, received: undefined',
        ],
        [
          'body does not contains attributes',
          { data: 'something' },
          'Expected array, received: undefined',
        ],
        [
          'ids are not provided',
          { data: { attributes: { badIdsAttribute: ['1523', '5684'] } } },
          'Expected array, received: undefined',
        ],
        [
          'ids_excluded are not provided',
          { data: { attributes: { ids: ['1523', '5684'], all_records: true } } },
          'Expected array, received: undefined',
        ],
        [
          'ids and ids_excluded are not the expected type',
          {
            data: {
              attributes: {
                all_records: ['not', 'a', 'boolean'],
                ids: 'not_an_array',
                all_records_ids_excluded: 45,
              },
            },
          },
          'Expected array, received: number',
        ],
        [
          'ids and ids_excluded members are not the expected type',
          {
            data: {
              attributes: {
                all_records: true,
                ids: ['string', 'string'],
                all_records_ids_excluded: ['string'],
              },
            },
          },
          'Failed to parse number from string',
        ],
      ])('should throw an error when %s', async (_, body, errorMessage) => {
        const bookCollection = factories.collection.build({
          name: 'books',
          schema: factories.collectionSchema.build({
            fields: {
              id: factories.columnSchema.isPrimaryKey().build({
                columnType: PrimitiveTypes.Number,
              }),
            },
          }),
        });
        const dataSource = factories.dataSource.buildWithCollection(bookCollection);
        const deleteRoute = new DeleteRoute(services, options, dataSource, 'books');

        const context = createMockContext({
          customProperties: { query: { timezone: 'Europe/Paris' } },
          requestBody: body,
        });
        await deleteRoute.handleListDelete(context);

        expect(context.throw).toHaveBeenCalledWith(HttpCode.BadRequest, errorMessage);
      });
    });

    describe('when the given ids are simples ids', () => {
      test('should generate the filter to delete the right records', async () => {
        const bookCollection = factories.collection.build({
          name: 'books',
          schema: factories.collectionSchema.build({
            fields: {
              id: factories.columnSchema.isPrimaryKey().build({
                columnType: PrimitiveTypes.Number,
              }),
            },
          }),
        });
        const dataSource = factories.dataSource.buildWithCollection(bookCollection);
        const deleteRoute = new DeleteRoute(services, options, dataSource, 'books');

        const context = createMockContext({
          customProperties: { query: { timezone: 'Europe/Paris' } },
          requestBody: {
            data: {
              attributes: { ids: ['1523', '5684'], all_records: false },
            },
          },
        });
        await deleteRoute.handleListDelete(context);

        expect(context.throw).not.toHaveBeenCalled();
        expect(bookCollection.delete).toHaveBeenCalledWith(
          factories.filter.build({
            conditionTree: factories.conditionTreeLeaf.build({
              operator: Operator.In,
              value: [1523, 5684],
              field: 'id',
            }),
            segment: null,
            timezone: 'Europe/Paris',
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
                id: factories.columnSchema.isPrimaryKey().build({
                  columnType: PrimitiveTypes.Number,
                }),
              },
            }),
          });
          const dataSource = factories.dataSource.buildWithCollection(bookCollection);
          const deleteRoute = new DeleteRoute(services, options, dataSource, 'books');

          const context = createMockContext({
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

          expect(context.throw).not.toHaveBeenCalled();
          expect(bookCollection.delete).toHaveBeenCalledWith(
            factories.filter.build({
              conditionTree: factories.conditionTreeLeaf.build({
                operator: Operator.NotEqual,
                value: 1523,
                field: 'id',
              }),
              segment: null,
              timezone: 'Europe/Paris',
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
              idField1: factories.columnSchema.isPrimaryKey().build({
                columnType: PrimitiveTypes.Number,
              }),
              idField2: factories.columnSchema.isPrimaryKey().build({
                columnType: PrimitiveTypes.Number,
              }),
              notIdField: factories.columnSchema.build({
                columnType: PrimitiveTypes.Number,
              }),
            },
          }),
        });
        const dataSource = factories.dataSource.buildWithCollection(bookCollection);
        const deleteRoute = new DeleteRoute(services, options, dataSource, 'books');

        const context = createMockContext({
          customProperties: { query: { timezone: 'Europe/Paris' } },
          requestBody: {
            data: {
              attributes: { ids: ['1523|1524', '1523|5688', '9999|7894'], all_records: false },
            },
          },
        });
        await deleteRoute.handleListDelete(context);

        expect(context.throw).not.toHaveBeenCalled();
        expect(bookCollection.delete).toHaveBeenCalledWith(
          factories.filter.build({
            conditionTree: factories.conditionTreeBranch.build({
              aggregator: Aggregator.Or,
              conditions: [
                factories.conditionTreeBranch.build({
                  aggregator: Aggregator.And,
                  conditions: [
                    factories.conditionTreeLeaf.build({
                      operator: Operator.Equal,
                      value: 1523,
                      field: 'idField1',
                    }),
                    factories.conditionTreeLeaf.build({
                      operator: Operator.In,
                      value: [1524, 5688],
                      field: 'idField2',
                    }),
                  ],
                }),
                factories.conditionTreeBranch.build({
                  aggregator: Aggregator.And,
                  conditions: [
                    factories.conditionTreeLeaf.build({
                      operator: Operator.Equal,
                      value: 9999,
                      field: 'idField1',
                    }),
                    factories.conditionTreeLeaf.build({
                      operator: Operator.Equal,
                      value: 7894,
                      field: 'idField2',
                    }),
                  ],
                }),
              ],
            }),
            segment: null,
            timezone: 'Europe/Paris',
          }),
        );
      });

      describe('with excluded mode', () => {
        test('should generate the filter to delete the right records', async () => {
          const bookCollection = factories.collection.build({
            name: 'books',
            schema: factories.collectionSchema.build({
              fields: {
                idField1: factories.columnSchema.isPrimaryKey().build({
                  columnType: PrimitiveTypes.Number,
                }),
                idField2: factories.columnSchema.isPrimaryKey().build({
                  columnType: PrimitiveTypes.Number,
                }),
                notIdField: factories.columnSchema.build({
                  columnType: PrimitiveTypes.Number,
                }),
              },
            }),
          });
          const dataSource = factories.dataSource.buildWithCollection(bookCollection);
          const deleteRoute = new DeleteRoute(services, options, dataSource, 'books');

          const context = createMockContext({
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

          expect(context.throw).not.toHaveBeenCalled();
          expect(bookCollection.delete).toHaveBeenCalledWith(
            factories.filter.build({
              conditionTree: factories.conditionTreeBranch.build({
                aggregator: Aggregator.Or,
                conditions: [
                  factories.conditionTreeLeaf.build({
                    operator: Operator.NotEqual,
                    value: 1523,
                    field: 'idField1',
                  }),
                  factories.conditionTreeLeaf.build({
                    operator: Operator.NotIn,
                    value: [1524, 5688],
                    field: 'idField2',
                  }),
                ],
              }),
              segment: null,
              timezone: 'Europe/Paris',
            }),
          );
        });
      });
    });
  });
});
