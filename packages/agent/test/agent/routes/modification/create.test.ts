import { FieldTypes, PrimitiveTypes } from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';

import * as factories from '../../__factories__';
import CreateRoute from '../../../../src/agent/routes/modification/create';

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

  describe('simple case', () => {
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
            name: factories.columnSchema.build({ columnType: PrimitiveTypes.String }),
            publishedAt: factories.columnSchema.build({ columnType: PrimitiveTypes.Date }),
            price: factories.columnSchema.build({ columnType: PrimitiveTypes.Number }),
          },
        }),
      });
      const dataSource = factories.dataSource.buildWithCollections([collection]);

      const create = new CreateRoute(services, options, dataSource, collection.name);

      const context = createMockContext({
        customProperties: { query: { timezone: 'Europe/Paris' } },
        requestBody: { data: { attributes, type: 'books' } },
      });

      await create.handleCreate(context);

      expect(collection.create).toHaveBeenCalledWith([attributes]);

      expect(context.response.body).toEqual({
        jsonapi: { version: '1.0' },
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

  describe('with relation', () => {
    const dataSource = factories.dataSource.buildWithCollections([
      factories.collection.build({
        name: 'persons',
        create: jest.fn().mockImplementation(items => items.map(item => ({ ...item, id: 1 }))),
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.isPrimaryKey().build(),
            name: factories.columnSchema.build(),
            passport: {
              type: FieldTypes.OneToOne,
              foreignCollection: 'passports',
              originKey: 'personId',
            },
          },
        }),
      }),
      factories.collection.build({
        name: 'passports',
        create: jest.fn().mockImplementation(items => items),
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.isPrimaryKey().build(),
            personId: factories.columnSchema.build({ columnType: PrimitiveTypes.Uuid }),
            person: {
              type: FieldTypes.ManyToOne,
              foreignCollection: 'persons',
              foreignKey: 'personId',
              foreignKeyTarget: 'id',
            },
          },
        }),
      }),
    ]);

    test('should work with a one to one relation', async () => {
      const create = new CreateRoute(services, options, dataSource, 'persons');
      const context = createMockContext({
        customProperties: { query: { timezone: 'Europe/Paris' } },
        requestBody: {
          data: {
            type: 'persons',
            attributes: { name: 'John' },
            relationships: {
              passport: { data: { type: 'passports', id: '1d162304-78bf-599e-b197-93590ac3d314' } },
            },
          },
          jsonapi: { version: '1.0' },
        },
      });

      await create.handleCreate(context);

      expect(dataSource.getCollection('persons').create).toHaveBeenCalled();
      expect(dataSource.getCollection('passports').update).toHaveBeenCalled();

      expect(context.response.body).toMatchObject({
        jsonapi: { version: '1.0' },
        data: {
          type: 'persons',
          id: '1',
          attributes: { id: 1, name: 'John' },
          relationships: {
            passport: { data: { type: 'passports', id: '1d162304-78bf-599e-b197-93590ac3d314' } },
          },
        },
      });
    });

    test('should work with a many to one relation', async () => {
      (dataSource.getCollection('passports').create as jest.Mock).mockImplementation(records =>
        records.map(r => ({ id: '123', ...r })),
      );

      const create = new CreateRoute(services, options, dataSource, 'passports');
      const context = createMockContext({
        customProperties: { query: { timezone: 'Europe/Paris' } },
        requestBody: {
          data: {
            type: 'persons',
            attributes: {},
            relationships: {
              person: { data: { type: 'persons', id: '1d162304-78bf-599e-b197-000000000000' } },
            },
          },
          jsonapi: { version: '1.0' },
        },
      });

      await create.handleCreate(context);

      expect(dataSource.getCollection('passports').create).toHaveBeenCalledWith([
        { personId: '1d162304-78bf-599e-b197-000000000000' },
      ]);

      expect(context.response.body).toMatchObject({
        data: {
          type: 'passports',
          id: '123',
          attributes: {},
          relationships: {
            person: { data: { type: 'persons', id: '1d162304-78bf-599e-b197-000000000000' } },
          },
        },
        jsonapi: { version: '1.0' },
      });
    });
  });
});
