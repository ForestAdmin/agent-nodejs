import { PrimitiveTypes } from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';
import CreateRoute from '../../../dist/routes/modification/create';
import * as factories from '../../__factories__';

describe('CreateRoute', () => {
  const services = factories.forestAdminHttpDriverServices.build();
  const dataSource = factories.dataSource.buildWithCollections([
    factories.collection.build({
      name: 'books',
      create: jest.fn().mockImplementation(() => []),
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.build({
            columnType: PrimitiveTypes.Uuid,
            isPrimaryKey: true,
          }),
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
    }),
  ]);
  const options = factories.forestAdminHttpDriverOptions.build();
  const router = factories.router.mockAllMethods().build();

  test('should register "/books" private routes', () => {
    const create = new CreateRoute(services, dataSource, options, 'books');
    create.setupPrivateRoutes(router);

    expect(router.post).toHaveBeenCalledWith('/books', expect.any(Function));
  });

  describe('handleCreate', () => {
    test('should call create and serializer implementation', async () => {
      services.serializer.deserialize = jest
        .fn()
        .mockImplementation((_, payload) => payload.attributes);
      services.serializer.serialize = jest.fn().mockReturnValue('test');
      const create = new CreateRoute(services, dataSource, options, 'books');
      const requestBody = {
        attributes: {
          name: 'Harry potter and the goblet of fire',
          publishedAt: '2000-07-07T21:00:00.000Z',
          price: 6.75,
        },
        type: 'books',
      };
      const context = createMockContext({ requestBody });

      await create.handleCreate(context);
      expect(services.serializer.deserialize).toHaveBeenCalledWith(
        dataSource.getCollection('books'),
        requestBody,
      );
      expect(dataSource.getCollection('books').create).toHaveBeenCalledWith([
        requestBody.attributes,
      ]);
      expect(services.serializer.serialize).toHaveBeenCalled();
      expect(context.response.body).toEqual('test');
    });

    describe('when an error happens', () => {
      describe('when request body does not match the schema types', () => {
        test('should return an HTTP 400 response', async () => {
          services.serializer.deserialize = jest
            .fn()
            .mockImplementation((_, data) => data.attributes);
          const create = new CreateRoute(services, dataSource, options, 'books');
          const requestBody = {
            attributes: {
              name: 'Harry potter and the goblet of fire',
              publishedAt: '2000-07-07T21:00:00.000Z',
              price: 'something-that-is-not-a-number',
            },
            type: 'books',
          };
          const context = createMockContext({ requestBody });
          await create.handleCreate(context);

          expect(context.throw).toHaveBeenCalledWith(
            400,
            'Wrong type for "price": something-that-is-not-a-number. Expects Number',
          );
        });
      });

      describe('if either create or serialize failed', () => {
        test('should return an HTTP 500 response', async () => {
          services.serializer.deserialize = jest
            .fn()
            .mockImplementation((_, data) => data.attributes);
          dataSource.getCollection('books').create = jest.fn().mockImplementation(() => {
            throw new Error();
          });
          const create = new CreateRoute(services, dataSource, options, 'books');
          const requestBody = {
            attributes: {
              name: 'Harry potter and the goblet of fire',
              publishedAt: '2000-07-07T21:00:00.000Z',
              price: 6.75,
            },
            type: 'books',
          };
          const context = createMockContext({ requestBody });
          await create.handleCreate(context);

          expect(context.throw).toHaveBeenCalledWith(
            500,
            'Failed to create record on collection "books"',
          );
        });
      });
    });
  });
});
