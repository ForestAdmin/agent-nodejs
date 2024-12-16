import { Filter } from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';

import AssociateRelatedRoute from '../../../src/routes/modification/associate-related';
import { HttpCode } from '../../../src/types';
import * as factories from '../../__factories__';

describe('AssociateRelatedRoute', () => {
  describe('when it is a one to many relation', () => {
    const setupWithOneToManyRelation = () => {
      const services = factories.forestAdminHttpDriverServices.build();
      const options = factories.forestAdminHttpDriverOptions.build();
      const router = factories.router.mockAllMethods().build();

      const bookPersons = factories.collection.build({
        name: 'bookPersons',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.uuidPrimaryKey().build(),
            bookId: factories.columnSchema.build({ columnType: 'Uuid' }),
          },
        }),
      });

      const books = factories.collection.build({
        name: 'books',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.uuidPrimaryKey().build(),
            myBookPersons: factories.oneToManySchema.build({
              foreignCollection: 'bookPersons',
              originKey: 'bookId',
              originKeyTarget: 'id',
            }),
          },
        }),
      });
      const dataSource = factories.dataSource.buildWithCollections([bookPersons, books]);

      return { dataSource, services, options, router };
    };

    test('should register the post route', () => {
      const { services, dataSource, options, router } = setupWithOneToManyRelation();

      const route = new AssociateRelatedRoute(
        services,
        options,
        dataSource,
        'books',
        'myBookPersons',
      );
      route.setupRoutes(router);

      expect(router.post).toHaveBeenCalledWith(
        '/books/:parentId/relationships/myBookPersons',
        expect.any(Function),
      );
    });

    test('should update the related records', async () => {
      // given
      const { services, dataSource, options } = setupWithOneToManyRelation();

      const route = new AssociateRelatedRoute(
        services,
        options,
        dataSource,
        'books',
        'myBookPersons',
      );

      const scope = factories.conditionTreeLeaf.build();
      services.authorization.getScope = jest.fn().mockResolvedValue(scope);

      const context = createMockContext({
        state: { user: { email: 'john.doe@domain.com' } },
        requestBody: { data: [{ id: '123e4567-e89b-12d3-a456-222222222222' }] },
        customProperties: {
          query: { timezone: 'Europe/Paris' },
          params: { parentId: '123e4567-e89b-12d3-a456-111111111111' },
        },
      });

      // when
      await route.handleAssociateRelatedRoute(context);

      // then
      expect(dataSource.getCollection('bookPersons').update).toHaveBeenCalledWith(
        {
          email: 'john.doe@domain.com',
          requestId: expect.any(String),
          request: { ip: expect.any(String) },
          timezone: 'Europe/Paris',
        },
        new Filter({
          conditionTree: factories.conditionTreeBranch.build({
            aggregator: 'And',
            conditions: [
              factories.conditionTreeLeaf.build({
                operator: 'Equal',
                value: '123e4567-e89b-12d3-a456-222222222222',
                field: 'id',
              }),
              scope,
            ],
          }),
          search: null,
          searchExtended: false,
          segment: expect.toBeNil(),
          liveQuerySegment: expect.toBeNil(),
        }),
        { bookId: '123e4567-e89b-12d3-a456-111111111111' },
      );
      expect(services.authorization.assertCanEdit).toHaveBeenCalledWith(context, 'books');
      expect(context.response.status).toEqual(HttpCode.NoContent);
    });
  });

  describe('when it is a many to many relation', () => {
    const setupWithManyToManyRelation = () => {
      const services = factories.forestAdminHttpDriverServices.build();
      const options = factories.forestAdminHttpDriverOptions.build();
      const router = factories.router.mockAllMethods().build();

      const libraries = factories.collection.build({
        name: 'libraries',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.uuidPrimaryKey().build(),
            manyToManyRelationField: factories.manyToManySchema.build({
              throughCollection: 'librariesBooks',
              foreignCollection: 'books',
              foreignKey: 'bookId',
              foreignKeyTarget: 'id',
              originKey: 'libraryId',
              originKeyTarget: 'id',
            }),
          },
        }),
      });

      const librariesBooks = factories.collection.build({
        name: 'librariesBooks',
        schema: factories.collectionSchema.build({
          fields: {
            bookId: factories.columnSchema.uuidPrimaryKey().build(),
            libraryId: factories.columnSchema.uuidPrimaryKey().build(),
            myBook: factories.manyToOneSchema.build({
              foreignCollection: 'books',
              foreignKey: 'bookId',
              foreignKeyTarget: 'id',
            }),
            myLibrary: factories.manyToOneSchema.build({
              foreignCollection: 'libraries',
              foreignKey: 'libraryId',
              foreignKeyTarget: 'id',
            }),
          },
        }),
      });

      const books = factories.collection.build({
        name: 'books',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.uuidPrimaryKey().build(),
            manyToManyRelationField: factories.manyToManySchema.build({
              throughCollection: 'librariesBooks',
              foreignCollection: 'libraries',
              foreignKey: 'libraryId',
              foreignKeyTarget: 'id',
              originKey: 'bookId',
              originKeyTarget: 'id',
            }),
          },
        }),
      });
      const dataSource = factories.dataSource.buildWithCollections([
        librariesBooks,
        books,
        libraries,
      ]);

      return { dataSource, services, options, router };
    };

    test('creates the relation in the many to many collection', async () => {
      // given
      const { services, dataSource, options } = setupWithManyToManyRelation();

      const route = new AssociateRelatedRoute(
        services,
        options,
        dataSource,
        'books',
        'manyToManyRelationField',
      );

      const scope = factories.conditionTreeLeaf.build();
      services.authorization.getScope = jest.fn().mockResolvedValue(scope);
      const context = createMockContext({
        state: { user: { email: 'john.doe@domain.com' } },
        requestBody: { data: [{ id: '123e4567-e89b-12d3-a456-222222222222' }] },
        customProperties: {
          query: { timezone: 'Europe/Paris' },
          params: { parentId: '123e4567-e89b-12d3-a456-111111111111' },
        },
      });

      // when
      await route.handleAssociateRelatedRoute(context);

      // then
      expect(dataSource.getCollection('librariesBooks').create).toHaveBeenCalledWith(
        {
          email: 'john.doe@domain.com',
          requestId: expect.any(String),
          request: { ip: expect.any(String) },
          timezone: 'Europe/Paris',
        },
        [
          {
            bookId: '123e4567-e89b-12d3-a456-111111111111',
            libraryId: '123e4567-e89b-12d3-a456-222222222222',
          },
        ],
      );
      expect(services.authorization.assertCanEdit).toHaveBeenCalledWith(context, 'books');
      expect(context.response.status).toEqual(HttpCode.NoContent);
    });
  });

  describe('with special characters in names', () => {
    it('should register routes with escaped characters', () => {
      const services = factories.forestAdminHttpDriverServices.build();
      const options = factories.forestAdminHttpDriverOptions.build();
      const router = factories.router.mockAllMethods().build();

      const bookPersons = factories.collection.build({
        name: 'bookPersons+*?',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.uuidPrimaryKey().build(),
            bookId: factories.columnSchema.build({ columnType: 'Uuid' }),
          },
        }),
      });

      const books = factories.collection.build({
        name: 'books+*?',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.uuidPrimaryKey().build(),
            myBookPersons: factories.oneToManySchema.build({
              foreignCollection: 'bookPersons',
              originKey: 'bookId',
              originKeyTarget: 'id',
            }),
          },
        }),
      });
      const dataSource = factories.dataSource.buildWithCollections([bookPersons, books]);

      const route = new AssociateRelatedRoute(
        services,
        options,
        dataSource,
        'books+*?',
        'myBookPersons+*?',
      );

      route.setupRoutes(router);

      expect(router.post).toHaveBeenCalledWith(
        '/books\\+\\*\\?/:parentId/relationships/myBookPersons\\+\\*\\?',
        expect.any(Function),
      );
    });
  });
});
