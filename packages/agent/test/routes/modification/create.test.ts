import { ConditionTreeLeaf, Filter } from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';

import CreateRoute from '../../../src/routes/modification/create';
import * as factories from '../../__factories__';

describe('CreateRoute', () => {
  const defaultContext = {
    state: { user: { email: 'john.doe@domain.com' } },
    customProperties: { query: { timezone: 'Europe/Paris' } },
  };
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
            id: factories.columnSchema.uuidPrimaryKey().build(),
            name: factories.columnSchema.build({ columnType: 'String' }),
            publishedAt: factories.columnSchema.build({ columnType: 'Date' }),
            price: factories.columnSchema.build({ columnType: 'Number' }),
          },
        }),
      });
      const dataSource = factories.dataSource.buildWithCollections([collection]);

      const create = new CreateRoute(services, options, dataSource, collection.name);

      const context = createMockContext({
        ...defaultContext,
        requestBody: { data: { attributes, type: 'books' } },
      });

      await create.handleCreate(context);

      expect(services.authorization.assertCanAdd).toHaveBeenCalledWith(context, 'books');

      expect(collection.create).toHaveBeenCalledWith(
        {
          email: 'john.doe@domain.com',
          requestId: expect.any(String),
          request: { ip: expect.any(String) },
          timezone: 'Europe/Paris',
        },
        [attributes],
      );

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
        create: jest.fn().mockImplementation((_, items) => items.map(item => ({ ...item, id: 1 }))),
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.uuidPrimaryKey().build(),
            name: factories.columnSchema.build(),
            countryId: factories.columnSchema.build({ columnType: 'Uuid' }),
            passport: {
              type: 'OneToOne',
              foreignCollection: 'passports',
              originKey: 'personId',
              originKeyTarget: 'id',
            },
            visa: {
              type: 'OneToOne',
              foreignCollection: 'visas',
              originKey: 'personId',
              originKeyTarget: 'id',
            },
            license: {
              type: 'OneToOne',
              foreignCollection: 'licenses',
              originKey: 'personId',
              originKeyTarget: 'id',
            },
            country: {
              type: 'ManyToOne',
              foreignCollection: 'countries',
              foreignKey: 'countryId',
              foreignKeyTarget: 'id',
            },
          },
        }),
      }),
      factories.collection.build({
        name: 'passports',
        create: jest.fn().mockImplementation((_, items) => items),
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.uuidPrimaryKey().build(),
            personId: factories.columnSchema.build({ columnType: 'Uuid' }),
            person: {
              type: 'ManyToOne',
              foreignCollection: 'persons',
              foreignKey: 'personId',
              foreignKeyTarget: 'id',
            },
          },
        }),
      }),
      ...['visas', 'licenses'].map(name =>
        factories.collection.build({
          name,
          schema: factories.collectionSchema.build({
            fields: {
              id: factories.columnSchema.uuidPrimaryKey().build(),
              personId: factories.columnSchema.build({ columnType: 'Uuid' }),
            },
          }),
        }),
      ),
      factories.collection.build({
        name: 'countries',
        schema: factories.collectionSchema.build({
          fields: { id: factories.columnSchema.uuidPrimaryKey().build() },
        }),
      }),
    ]);

    describe('with one to one relation', () => {
      test('calls the create method and returns the correct body', async () => {
        const create = new CreateRoute(services, options, dataSource, 'persons');
        const context = createMockContext({
          ...defaultContext,
          requestBody: {
            data: {
              type: 'persons',
              attributes: { name: 'John' },
              relationships: {
                passport: {
                  data: { type: 'passports', id: '1d162304-78bf-599e-b197-93590ac3d314' },
                },
              },
            },
            jsonapi: { version: '1.0' },
          },
        });

        const spy = jest.spyOn(dataSource.getCollection('passports'), 'update');

        await create.handleCreate(context);

        expect(dataSource.getCollection('persons').create).toHaveBeenCalled();
        expect(spy.mock.calls).toEqual([
          [
            {
              email: 'john.doe@domain.com',
              requestId: expect.any(String),
              request: { ip: expect.any(String) },
              timezone: 'Europe/Paris',
            },
            new Filter({ conditionTree: new ConditionTreeLeaf('personId', 'Equal', 1) }),
            { personId: null },
          ],
          [
            {
              email: 'john.doe@domain.com',
              requestId: expect.any(String),
              request: { ip: expect.any(String) },
              timezone: 'Europe/Paris',
            },
            new Filter({
              conditionTree: new ConditionTreeLeaf(
                'id',
                'Equal',
                '1d162304-78bf-599e-b197-93590ac3d314',
              ),
            }),
            { personId: 1 },
          ],
        ]);

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

      test('checks the edit permission once per linked one-to-one foreign collection', async () => {
        const create = new CreateRoute(services, options, dataSource, 'persons');
        const context = createMockContext({
          ...defaultContext,
          requestBody: {
            data: {
              type: 'persons',
              attributes: { name: 'John' },
              relationships: {
                passport: {
                  data: { type: 'passports', id: '1d162304-78bf-599e-b197-93590ac3d314' },
                },
                visa: { data: { type: 'visas', id: '2d162304-78bf-599e-b197-93590ac3d314' } },
                license: { data: null },
                country: {
                  data: { type: 'countries', id: '3d162304-78bf-599e-b197-93590ac3d314' },
                },
              },
            },
            jsonapi: { version: '1.0' },
          },
        });

        const assertCanEdit = services.authorization.assertCanEdit as jest.Mock;
        assertCanEdit.mockClear();

        await create.handleCreate(context);

        const checkedCollections = assertCanEdit.mock.calls.map(([, name]) => name);
        expect(checkedCollections.sort()).toEqual(['passports', 'visas']);
        expect(assertCanEdit).toHaveBeenCalledWith(context, 'passports');
        expect(assertCanEdit).toHaveBeenCalledWith(context, 'visas');
        expect(assertCanEdit).not.toHaveBeenCalledWith(context, 'licenses');
        expect(assertCanEdit).not.toHaveBeenCalledWith(context, 'countries');
      });

      test('does not create the parent nor update any foreign collection when one edit is denied', async () => {
        const create = new CreateRoute(services, options, dataSource, 'persons');
        const context = createMockContext({
          ...defaultContext,
          requestBody: {
            data: {
              type: 'persons',
              attributes: { name: 'John' },
              relationships: {
                passport: {
                  data: { type: 'passports', id: '1d162304-78bf-599e-b197-93590ac3d314' },
                },
                visa: { data: { type: 'visas', id: '2d162304-78bf-599e-b197-93590ac3d314' } },
              },
            },
            jsonapi: { version: '1.0' },
          },
        });

        const error = new Error('Forbidden');
        const assertCanEdit = services.authorization.assertCanEdit as jest.Mock;
        assertCanEdit.mockImplementation((_, name) =>
          name === 'passports' ? Promise.reject(error) : Promise.resolve(),
        );
        const create$ = jest.spyOn(dataSource.getCollection('persons'), 'create').mockClear();
        const passportUpdate$ = jest
          .spyOn(dataSource.getCollection('passports'), 'update')
          .mockClear();
        const visaUpdate$ = jest.spyOn(dataSource.getCollection('visas'), 'update').mockClear();

        try {
          await expect(create.handleCreate(context)).rejects.toThrow(error);

          expect(create$).not.toHaveBeenCalled();
          expect(passportUpdate$).not.toHaveBeenCalled();
          expect(visaUpdate$).not.toHaveBeenCalled();
        } finally {
          assertCanEdit.mockReset();
        }
      });

      describe('when the given relation is null', () => {
        test('should return null value in the body', async () => {
          const create = new CreateRoute(services, options, dataSource, 'persons');
          const context = createMockContext({
            ...defaultContext,
            requestBody: {
              data: {
                type: 'persons',
                attributes: { name: 'John' },
                relationships: {
                  passport: {
                    data: null,
                  },
                },
              },
              jsonapi: { version: '1.0' },
            },
          });

          await create.handleCreate(context);

          expect(dataSource.getCollection('persons').create).toHaveBeenCalled();

          expect(context.response.body).toMatchObject({
            jsonapi: { version: '1.0' },
            data: {
              type: 'persons',
              id: '1',
              attributes: { id: 1, name: 'John' },
              relationships: {
                passport: {
                  data: null,
                },
              },
            },
          });
        });
      });
    });

    describe('with a many to one relation', () => {
      test('calls the create method and returns the correct body', async () => {
        (dataSource.getCollection('passports').create as jest.Mock).mockImplementation(
          (_, records) => records.map(r => ({ id: '123', ...r })),
        );

        const create = new CreateRoute(services, options, dataSource, 'passports');
        const context = createMockContext({
          ...defaultContext,
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

        expect(dataSource.getCollection('passports').create).toHaveBeenCalledWith(
          {
            email: 'john.doe@domain.com',
            requestId: expect.any(String),
            request: { ip: expect.any(String) },
            timezone: 'Europe/Paris',
          },
          [{ personId: '1d162304-78bf-599e-b197-000000000000' }],
        );

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

      describe('when the given relation is null', () => {
        test('should return null value in the body', async () => {
          (dataSource.getCollection('passports').create as jest.Mock).mockImplementation(
            (_, records) => records.map(r => ({ id: '123', ...r })),
          );

          const create = new CreateRoute(services, options, dataSource, 'passports');
          const context = createMockContext({
            ...defaultContext,
            requestBody: {
              data: {
                type: 'persons',
                attributes: {},
                relationships: {
                  person: { data: null },
                },
              },
              jsonapi: { version: '1.0' },
            },
          });

          await create.handleCreate(context);

          expect(context.response.body).toMatchObject({
            data: {
              type: 'passports',
              id: '123',
              attributes: {},
              relationships: {
                person: { data: null },
              },
            },
            jsonapi: { version: '1.0' },
          });
        });
      });
    });
  });

  describe('with special characters in names', () => {
    it('should register routes with escaped characters', () => {
      const dataSource = factories.dataSource.buildWithCollection(
        factories.collection.build({ name: 'books+*?' }),
      );
      const create = new CreateRoute(services, options, dataSource, 'books+*?');

      create.setupRoutes(router);

      expect(router.post).toHaveBeenCalledWith('/books\\+\\*\\?', expect.any(Function));
    });
  });
});
