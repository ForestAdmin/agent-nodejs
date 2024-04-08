import { Aggregation, Filter } from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';

import UpdateRelationRoute from '../../../src/routes/modification/update-relation';
import { HttpCode } from '../../../src/types';
import * as factories from '../../__factories__';

describe('UpdateRelationRoute', () => {
  const setupWithManyToOneRelation = (namesSuffix = '') => {
    const services = factories.forestAdminHttpDriverServices.build();
    const options = factories.forestAdminHttpDriverOptions.build();
    const router = factories.router.mockAllMethods().build();

    const persons = factories.collection.build({
      name: `persons${namesSuffix}`,
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.uuidPrimaryKey().build(),
          name: factories.columnSchema.build({ columnType: 'String' }),
        },
      }),
    });

    const books = factories.collection.build({
      name: `books${namesSuffix}`,
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.uuidPrimaryKey().build(),
          personId: factories.columnSchema.build({ columnType: 'Uuid' }),
          myPersons: factories.manyToOneSchema.build({
            foreignCollection: `persons${namesSuffix}`,
            foreignKey: 'personId',
          }),
        },
      }),
    });
    const dataSource = factories.dataSource.buildWithCollections([persons, books]);

    return { dataSource, services, options, router, persons, books };
  };

  test('should register PUT route', () => {
    const { services, dataSource, options, router } = setupWithManyToOneRelation();

    const update = new UpdateRelationRoute(services, options, dataSource, 'books', 'myPersons');
    update.setupRoutes(router);

    expect(router.put).toHaveBeenCalledWith(
      '/books/:parentId/relationships/myPersons',
      expect.any(Function),
    );
  });

  test('it should register the route with escaped characters', () => {
    const { services, dataSource, options, router } = setupWithManyToOneRelation('+*?');

    const update = new UpdateRelationRoute(
      services,
      options,
      dataSource,
      'books+*?',
      'myPersons+*?',
    );
    update.setupRoutes(router);

    expect(router.put).toHaveBeenCalledWith(
      '/books\\+\\*\\?/:parentId/relationships/myPersons\\+\\*\\?',
      expect.any(Function),
    );
  });

  describe('handleUpdateRelationRoute', () => {
    describe('with many to one relation', () => {
      test('should remove the many-to-one association', async () => {
        const { services, dataSource, options } = setupWithManyToOneRelation();

        const update = new UpdateRelationRoute(services, options, dataSource, 'books', 'myPersons');
        const context = createMockContext({
          state: { user: { email: 'john.doe@domain.com' } },
          customProperties: {
            query: { timezone: 'Europe/Paris' },
            params: { parentId: '00000000-0000-4000-8000-000000000000' },
          },
          requestBody: {},
        });

        const scopeCondition = factories.conditionTreeLeaf.build();
        services.authorization.getScope = jest.fn().mockResolvedValue(scopeCondition);

        await update.handleUpdateRelationRoute(context);

        expect(dataSource.getCollection('books').update).toHaveBeenCalledWith(
          { email: 'john.doe@domain.com', requestId: expect.any(String), timezone: 'Europe/Paris' },
          new Filter({
            conditionTree: factories.conditionTreeBranch.build({
              aggregator: 'And',
              conditions: [
                factories.conditionTreeLeaf.build({
                  operator: 'Equal',
                  value: '00000000-0000-4000-8000-000000000000',
                  field: 'id',
                }),
                scopeCondition,
              ],
            }),
          }),
          { personId: null },
        );

        expect(context.response.status).toEqual(HttpCode.NoContent);
        expect(services.authorization.assertCanEdit).toHaveBeenCalledWith(context, 'books');
      });

      test('should change the many-to-one association', async () => {
        const { services, dataSource, options } = setupWithManyToOneRelation();

        const update = new UpdateRelationRoute(services, options, dataSource, 'books', 'myPersons');
        const context = createMockContext({
          state: { user: { email: 'john.doe@domain.com' } },
          customProperties: {
            query: { timezone: 'Europe/Paris' },
            params: { parentId: '00000000-0000-4000-8000-000000000000' },
          },
          requestBody: {
            data: { id: '11111111-1111-4111-8111-111111111111', type: 'myPersons' },
          },
        });

        const scopeCondition = factories.conditionTreeLeaf.build();
        services.authorization.getScope = jest.fn().mockResolvedValue(scopeCondition);

        await update.handleUpdateRelationRoute(context);

        expect(dataSource.getCollection('books').update).toHaveBeenCalledWith(
          { email: 'john.doe@domain.com', requestId: expect.any(String), timezone: 'Europe/Paris' },
          new Filter({
            conditionTree: factories.conditionTreeBranch.build({
              aggregator: 'And',
              conditions: [
                factories.conditionTreeLeaf.build({
                  operator: 'Equal',
                  value: '00000000-0000-4000-8000-000000000000',
                  field: 'id',
                }),
                scopeCondition,
              ],
            }),
          }),
          { personId: '11111111-1111-4111-8111-111111111111' },
        );

        expect(context.response.status).toEqual(HttpCode.NoContent);
        expect(services.authorization.assertCanEdit).toHaveBeenCalledWith(context, 'books');
      });
    });

    describe('with one to one relation', () => {
      const setupWithOneToOneRelation = () => {
        const services = factories.forestAdminHttpDriverServices.build();
        const options = factories.forestAdminHttpDriverOptions.build();
        const router = factories.router.mockAllMethods().build();

        const books = factories.collection.build({
          name: 'book',
          schema: factories.collectionSchema.build({
            fields: {
              id: factories.columnSchema.uuidPrimaryKey().build(),
              owner: factories.oneToOneSchema.build({
                foreignCollection: 'owner',
                originKey: 'bookId',
                originKeyTarget: 'id',
              }),
            },
          }),
        });

        const owners = factories.collection.build({
          name: 'owner',
          schema: factories.collectionSchema.build({
            fields: {
              id: factories.columnSchema.uuidPrimaryKey().build(),
              bookId: factories.columnSchema.build(),
              book: factories.manyToOneSchema.build({
                foreignCollection: 'book',
                foreignKey: 'bookId',
              }),
            },
          }),
        });

        const dataSource = factories.dataSource.buildWithCollections([books, owners]);

        return { dataSource, services, options, router, books, owners };
      };

      test('should remove the one-to-one association', async () => {
        const { services, dataSource, options, owners } = setupWithOneToOneRelation();

        const update = new UpdateRelationRoute(services, options, dataSource, 'book', 'owner');
        const context = createMockContext({
          state: { user: { email: 'john.doe@domain.com' } },
          customProperties: {
            query: { timezone: 'Europe/Paris' },
            params: { parentId: '00000000-0000-4000-8000-000000000000' },
          },
          requestBody: {},
        });

        (owners.aggregate as jest.Mock).mockResolvedValueOnce([{ value: 1 }]);

        await update.handleUpdateRelationRoute(context);

        const expectedFilter = new Filter({
          conditionTree: factories.conditionTreeLeaf.build({
            operator: 'Equal',
            value: '00000000-0000-4000-8000-000000000000',
            field: 'bookId',
          }),
        });

        const caller = {
          email: 'john.doe@domain.com',
          requestId: expect.any(String),
          timezone: 'Europe/Paris',
        };

        expect(owners.aggregate).toHaveBeenCalledWith(
          caller,
          expectedFilter,
          new Aggregation({ operation: 'Count' }),
          1,
        );

        expect(owners.update).toHaveBeenCalledTimes(1);
        expect(owners.update).toHaveBeenCalledWith(caller, expectedFilter, { bookId: null });

        expect(context.response.status).toEqual(HttpCode.NoContent);
        expect(services.authorization.assertCanEdit).toHaveBeenCalledWith(context, 'owner');
      });

      test('should change the one-to-one association', async () => {
        const { services, dataSource, options, owners } = setupWithOneToOneRelation();

        const update = new UpdateRelationRoute(services, options, dataSource, 'book', 'owner');
        const context = createMockContext({
          state: { user: { email: 'john.doe@domain.com' } },
          customProperties: {
            query: { timezone: 'Europe/Paris' },
            params: { parentId: '00000000-0000-4000-8000-000000000000' },
          },
          requestBody: {
            data: { id: '11111111-1111-4111-8111-111111111111', type: 'owner' },
          },
        });

        (owners.aggregate as jest.Mock).mockResolvedValueOnce([{ value: 1 }]);

        await update.handleUpdateRelationRoute(context);

        const expectedFilter = new Filter({
          conditionTree: factories.conditionTreeBranch.build({
            aggregator: 'And',
            conditions: [
              factories.conditionTreeLeaf.build({
                operator: 'Equal',
                value: '00000000-0000-4000-8000-000000000000',
                field: 'bookId',
              }),
              factories.conditionTreeLeaf.build({
                operator: 'NotEqual',
                value: '11111111-1111-4111-8111-111111111111',
                field: 'id',
              }),
            ],
          }),
        });

        const caller = {
          email: 'john.doe@domain.com',
          requestId: expect.any(String),
          timezone: 'Europe/Paris',
        };

        expect(owners.aggregate).toHaveBeenCalledWith(
          caller,
          expectedFilter,
          new Aggregation({ operation: 'Count' }),
          1,
        );

        expect(owners.update).toHaveBeenNthCalledWith(1, caller, expectedFilter, { bookId: null });

        expect(owners.update).toHaveBeenNthCalledWith(
          2,
          caller,
          new Filter({
            conditionTree: factories.conditionTreeLeaf.build({
              operator: 'Equal',
              value: '11111111-1111-4111-8111-111111111111',
              field: 'id',
            }),
          }),
          { bookId: '00000000-0000-4000-8000-000000000000' },
        );

        expect(context.response.status).toEqual(HttpCode.NoContent);
        expect(services.authorization.assertCanEdit).toHaveBeenCalledWith(context, 'owner');
      });

      test('should not remove the association on the new record to avoid errors with notNull constraints', async () => {
        const { services, dataSource, options, owners } = setupWithOneToOneRelation();

        const update = new UpdateRelationRoute(services, options, dataSource, 'book', 'owner');
        const context = createMockContext({
          state: { user: { email: 'john.doe@domain.com' } },
          customProperties: {
            query: { timezone: 'Europe/Paris' },
            params: { parentId: '00000000-0000-4000-8000-000000000000' },
          },
          requestBody: {
            data: { id: '11111111-1111-4111-8111-111111111111', type: 'owner' },
          },
        });

        (owners.aggregate as jest.Mock).mockResolvedValueOnce([{ value: 0 }]);

        await update.handleUpdateRelationRoute(context);

        const expectedFilter = new Filter({
          conditionTree: factories.conditionTreeBranch.build({
            aggregator: 'And',
            conditions: [
              factories.conditionTreeLeaf.build({
                operator: 'Equal',
                value: '00000000-0000-4000-8000-000000000000',
                field: 'bookId',
              }),
              factories.conditionTreeLeaf.build({
                operator: 'NotEqual',
                value: '11111111-1111-4111-8111-111111111111',
                field: 'id',
              }),
            ],
          }),
        });

        const caller = {
          email: 'john.doe@domain.com',
          requestId: expect.any(String),
          timezone: 'Europe/Paris',
        };

        expect(owners.aggregate).toHaveBeenCalledWith(
          caller,
          expectedFilter,
          new Aggregation({ operation: 'Count' }),
          1,
        );

        expect(owners.update).toHaveBeenCalledOnce();
        expect(owners.update).toHaveBeenCalledWith(
          caller,
          new Filter({
            conditionTree: factories.conditionTreeLeaf.build({
              operator: 'Equal',
              value: '11111111-1111-4111-8111-111111111111',
              field: 'id',
            }),
          }),
          { bookId: '00000000-0000-4000-8000-000000000000' },
        );

        expect(context.response.status).toEqual(HttpCode.NoContent);
        expect(services.authorization.assertCanEdit).toHaveBeenCalledWith(context, 'owner');
      });
    });
  });
});
