import { PrimitiveTypes } from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';

import * as factories from '../../__factories__';
import CreateRoute from '../../../src/routes/modification/create';

describe('CreateRoute', () => {
  const services = factories.forestAdminHttpDriverServices.build();
  const options = factories.forestAdminHttpDriverOptions.build();
  const router = factories.router.mockAllMethods().build();

  test('should register "/books" route', () => {
    const dataSource = factories.dataSource.buildWithCollection(
      factories.collection.build({ name: 'books' }),
    );
    const create = new CreateRoute(services, options, dataSource, 'books');

    create.setupRoutes(router);

    expect(router.post).toHaveBeenCalledWith('/books', expect.any(Function));
  });

  describe('handleCreate', () => {
    test('should call create and serializer implementation', async () => {
      const attributes = {
        name: 'Harry potter and thegoblet of fire',
        publishedAt: '2000-07-07T21:00:00.000Z',
        price: 6.75,
      };

      const collection = factories.collection.build({
        name: 'books',
        create: jest.fn().mockImplementation(() => [
          {
            id: 1,
            name: attributes.name,
            publishedAt: attributes.publishedAt,
            price: attributes.price,
          },
        ]),
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.isPrimaryKey().build(),
            name: factories.columnSchema.build({
              columnType: PrimitiveTypes.String,
            }),
            publishedAt: factories.columnSchema.build({
              columnType: PrimitiveTypes.Date,
            }),
            price: factories.columnSchema.build({
              columnType: PrimitiveTypes.Number,
            }),
          },
        }),
      });
      const dataSource = factories.dataSource.buildWithCollections([collection]);

      const create = new CreateRoute(services, options, dataSource, collection.name);

      const requestBody = {
        data: {
          attributes,
          type: 'books',
        },
      };
      const context = createMockContext({ requestBody });

      await create.handleCreate(context);
      expect(context.throw).not.toHaveBeenCalled();
      expect(collection.create).toHaveBeenCalledWith([requestBody.data.attributes]);

      expect(context.response.body).toEqual({
        jsonapi: {
          version: '1.0',
        },
        data: {
          type: 'books',
          id: '1',
          attributes: {
            id: 1,
            name: 'Harry potter and thegoblet of fire',
            publishedAt: '2000-07-07T21:00:00.000Z',
            price: 6.75,
          },
        },
      });
    });
  });
});
