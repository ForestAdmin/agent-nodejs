import { PrimitiveTypes } from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';
import CreateRoute from '../../../dist/routes/modification/create';
import * as factories from '../../__factories__';
import { HttpCode } from '../../../dist/types';

describe('CreateRoute', () => {
  const services = factories.forestAdminHttpDriverServices.build();
  const options = factories.forestAdminHttpDriverOptions.build();
  const router = factories.router.mockAllMethods().build();

  test('should register "/books" private routes', () => {
    const dataSource = factories.dataSource.buildWithCollection(
      factories.collection.build({ name: 'books' }),
    );
    const create = new CreateRoute(services, dataSource, options, 'books');

    create.setupPrivateRoutes(router);

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

      const create = new CreateRoute(services, dataSource, options, collection.name);

      const requestBody = {
        data: {
          attributes,
          type: 'books',
        },
      };
      const context = createMockContext({ requestBody });

      await create.handleCreate(context);
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

    describe('when an error happens', () => {
      describe('when request body does not match the schema types', () => {
        test('should return an HTTP 400 response', async () => {
          const collection = factories.collection.build({
            name: 'books',
            schema: factories.collectionSchema.build({
              fields: {
                name: factories.columnSchema.build({
                  columnType: PrimitiveTypes.String,
                }),
              },
            }),
          });
          const dataSource = factories.dataSource.buildWithCollections([collection]);

          const create = new CreateRoute(services, dataSource, options, collection.name);

          const requestBody = {
            data: {
              attributes: {
                failNameAttribute: 'this field does not exist in schema',
              },
              type: 'books',
            },
          };
          const context = createMockContext({ requestBody });

          await create.handleCreate(context);

          expect(context.throw).toHaveBeenCalledWith(
            HttpCode.BadRequest,
            'Unknown field "failNameAttribute"',
          );
        });
      });

      describe('if either create or serialize failed', () => {
        test('should return an HTTP 500 response', async () => {
          const collection = factories.collection.build({
            name: 'books',
            create: jest.fn().mockImplementation(() => {
              throw new Error();
            }),
            schema: factories.collectionSchema.build({
              fields: {
                name: factories.columnSchema.build({
                  columnType: PrimitiveTypes.String,
                }),
              },
            }),
          });

          const dataSource = factories.dataSource.buildWithCollections([collection]);

          const create = new CreateRoute(services, dataSource, options, 'books');

          const requestBody = {
            data: {
              attributes: {
                name: 'Harry potter and thegoblet of fire',
              },
              type: 'books',
            },
          };
          const context = createMockContext({ requestBody });
          await create.handleCreate(context);

          expect(context.throw).toHaveBeenCalledWith(
            HttpCode.InternalServerError,
            'Failed to create record on collection "books"',
          );
        });
      });
    });
  });
});
