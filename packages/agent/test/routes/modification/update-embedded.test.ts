import { Aggregator, Operator, PrimitiveTypes } from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';

import * as factories from '../../__factories__';
import { HttpCode } from '../../../dist/types';
import UpdateEmbeddedRoute from '../../../src/routes/modification/update-embedded';

describe('UpdateEmbeddedRoute', () => {
  const setupWithManyToOneRelation = () => {
    const services = factories.forestAdminHttpDriverServices.build();
    const options = factories.forestAdminHttpDriverOptions.build();
    const router = factories.router.mockAllMethods().build();

    const persons = factories.collection.build({
      name: 'persons',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.isPrimaryKey().build(),
          name: factories.columnSchema.build({ columnType: PrimitiveTypes.String }),
        },
      }),
    });

    const books = factories.collection.build({
      name: 'books',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.isPrimaryKey().build(),
          personId: factories.columnSchema.build({ columnType: PrimitiveTypes.Uuid }),
          myPersons: factories.manyToOneSchema.build({
            foreignCollection: 'persons',
            foreignKey: 'personId',
          }),
        },
      }),
    });
    const dataSource = factories.dataSource.buildWithCollections([persons, books]);

    return {
      dataSource,
      services,
      options,
      router,
    };
  };

  test('should register PUT route', () => {
    const { services, dataSource, options, router } = setupWithManyToOneRelation();

    const update = new UpdateEmbeddedRoute(services, options, dataSource, 'books', 'myPersons');
    update.setupRoutes(router);

    expect(router.put).toHaveBeenCalledWith(
      '/books/:parentId/relationships/myPersons',
      expect.any(Function),
    );
  });

  describe('handleUpdateEmbeddedRoute', () => {
    test('should update the relation with the scope', async () => {
      const { services, dataSource, options } = setupWithManyToOneRelation();

      const update = new UpdateEmbeddedRoute(services, options, dataSource, 'books', 'myPersons');

      const customProperties = { params: { parentId: '123e4567-e89b-12d3-a456-426614174088' } };
      const requestBody = {
        data: { id: '123e4567-e89b-12d3-a456-426614174089', type: 'myPersons' },
      };
      const context = createMockContext({ customProperties, requestBody });

      const scopeCondition = factories.conditionTreeLeaf.build();
      services.permissions.getScope = jest.fn().mockResolvedValue(scopeCondition);

      await update.handleUpdateEmbeddedRoute(context);

      expect(dataSource.getCollection('books').update).toHaveBeenCalledWith(
        factories.filter.build({
          conditionTree: factories.conditionTreeBranch.build({
            aggregator: Aggregator.And,
            conditions: [
              factories.conditionTreeLeaf.build({
                operator: Operator.Equal,
                value: '123e4567-e89b-12d3-a456-426614174088',
                field: 'id',
              }),
              scopeCondition,
            ],
          }),
        }),
        { personId: ['123e4567-e89b-12d3-a456-426614174089'] },
      );

      expect(context.response.status).toEqual(HttpCode.NoContent);
    });

    test('should check the edit permission', async () => {
      const { services, dataSource, options } = setupWithManyToOneRelation();

      const update = new UpdateEmbeddedRoute(services, options, dataSource, 'books', 'myPersons');

      const customProperties = { params: { parentId: '123e4567-e89b-12d3-a456-426614174088' } };
      const requestBody = {
        data: { id: '123e4567-e89b-12d3-a456-426614174089', type: 'myPersons' },
      };
      const context = createMockContext({ customProperties, requestBody });

      await update.handleUpdateEmbeddedRoute(context);

      expect(services.permissions.can).toHaveBeenCalledWith(context, 'edit:books');
    });
  });
});
