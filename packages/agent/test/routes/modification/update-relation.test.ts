import { Filter } from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';

import UpdateRelationRoute from '../../../src/routes/modification/update-relation';
import { HttpCode } from '../../../src/types';
import * as factories from '../../__factories__';

describe('UpdateRelationRoute', () => {
  const setupWithManyToOneRelation = () => {
    const services = factories.forestAdminHttpDriverServices.build();
    const options = factories.forestAdminHttpDriverOptions.build();
    const router = factories.router.mockAllMethods().build();

    const persons = factories.collection.build({
      name: 'persons',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.uuidPrimaryKey().build(),
          name: factories.columnSchema.build({ columnType: 'String' }),
        },
      }),
    });

    const books = factories.collection.build({
      name: 'books',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.uuidPrimaryKey().build(),
          personId: factories.columnSchema.build({ columnType: 'Uuid' }),
          myPersons: factories.manyToOneSchema.build({
            foreignCollection: 'persons',
            foreignKey: 'personId',
          }),
        },
      }),
    });
    const dataSource = factories.dataSource.buildWithCollections([persons, books]);

    return { dataSource, services, options, router };
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
          { email: 'john.doe@domain.com', timezone: 'Europe/Paris' },
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
          { email: 'john.doe@domain.com', timezone: 'Europe/Paris' },
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
        const dataSource = factories.dataSource.buildWithCollections([
          factories.collection.build({
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
          }),
          factories.collection.build({
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
          }),
        ]);

        return { dataSource, services, options, router };
      };

      test('should remove the one-to-one association', async () => {
        const { services, dataSource, options } = setupWithOneToOneRelation();

        const update = new UpdateRelationRoute(services, options, dataSource, 'book', 'owner');
        const context = createMockContext({
          state: { user: { email: 'john.doe@domain.com' } },
          customProperties: {
            query: { timezone: 'Europe/Paris' },
            params: { parentId: '00000000-0000-4000-8000-000000000000' },
          },
          requestBody: {},
        });

        await update.handleUpdateRelationRoute(context);

        expect(dataSource.getCollection('owner').update).toHaveBeenCalledTimes(1);
        expect(dataSource.getCollection('owner').update).toHaveBeenCalledWith(
          { email: 'john.doe@domain.com', timezone: 'Europe/Paris' },
          new Filter({
            conditionTree: factories.conditionTreeLeaf.build({
              operator: 'Equal',
              value: '00000000-0000-4000-8000-000000000000',
              field: 'bookId',
            }),
          }),
          { bookId: null },
        );

        expect(context.response.status).toEqual(HttpCode.NoContent);
        expect(services.authorization.assertCanEdit).toHaveBeenCalledWith(context, 'owner');
      });

      test('should change the one-to-one association', async () => {
        const { services, dataSource, options } = setupWithOneToOneRelation();

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

        await update.handleUpdateRelationRoute(context);

        expect(dataSource.getCollection('owner').update).toHaveBeenNthCalledWith(
          1,
          { email: 'john.doe@domain.com', timezone: 'Europe/Paris' },
          new Filter({
            conditionTree: factories.conditionTreeLeaf.build({
              operator: 'Equal',
              value: '00000000-0000-4000-8000-000000000000',
              field: 'bookId',
            }),
          }),
          { bookId: null },
        );

        expect(dataSource.getCollection('owner').update).toHaveBeenNthCalledWith(
          2,
          { email: 'john.doe@domain.com', timezone: 'Europe/Paris' },
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
