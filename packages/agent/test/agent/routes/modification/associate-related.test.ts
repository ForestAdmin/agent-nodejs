import { Filter } from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';

import * as factories from '../../__factories__';
import { HttpCode } from '../../../../src/agent/types';
import AssociateRelatedRoute from '../../../../src/agent/routes/modification/associate-related';

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
            id: factories.columnSchema.isPrimaryKey().build(),
            bookId: factories.columnSchema.build({ columnType: 'Uuid' }),
          },
        }),
      });

      const books = factories.collection.build({
        name: 'books',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.isPrimaryKey().build(),
            myBookPersons: factories.oneToManySchema.build({
              foreignCollection: 'bookPersons',
              originKey: 'bookId',
              originKeyTarget: 'id',
            }),
          },
        }),
      });
      const dataSource = factories.dataSource.buildWithCollections([bookPersons, books]);

      return {
        dataSource,
        services,
        options,
        router,
      };
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
      services.permissions.getScope = jest.fn().mockResolvedValue(scope);
      const customProperties = {
        query: {
          timezone: 'Europe/Paris',
        },
        params: { parentId: '123e4567-e89b-12d3-a456-111111111111' },
      };
      const requestBody = {
        data: [{ id: '123e4567-e89b-12d3-a456-222222222222' }],
      };
      const context = createMockContext({ customProperties, requestBody });

      // when
      await route.handleAssociateRelatedRoute(context);

      // then
      expect(dataSource.getCollection('bookPersons').update).toHaveBeenCalledWith(
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
          segment: null,
          timezone: 'Europe/Paris',
        }),
        { bookId: '123e4567-e89b-12d3-a456-111111111111' },
      );
      expect(services.permissions.can).toHaveBeenCalledWith(context, 'edit:books');
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
            id: factories.columnSchema.isPrimaryKey().build(),
            manyToManyRelationField: factories.manyToManySchema.build({
              throughCollection: 'librariesBooks',
              foreignRelation: 'myBook',
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
            bookId: factories.columnSchema.isPrimaryKey().build(),
            libraryId: factories.columnSchema.isPrimaryKey().build(),
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
            id: factories.columnSchema.isPrimaryKey().build(),
            manyToManyRelationField: factories.manyToManySchema.build({
              throughCollection: 'librariesBooks',
              foreignRelation: 'myLibrary',
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

      return {
        dataSource,
        services,
        options,
        router,
      };
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
      services.permissions.getScope = jest.fn().mockResolvedValue(scope);
      const customProperties = {
        query: {
          timezone: 'Europe/Paris',
        },
        params: { parentId: '123e4567-e89b-12d3-a456-111111111111' },
      };
      const requestBody = {
        data: [{ id: '123e4567-e89b-12d3-a456-222222222222' }],
      };
      const context = createMockContext({ customProperties, requestBody });

      // when
      await route.handleAssociateRelatedRoute(context);

      // then
      expect(dataSource.getCollection('librariesBooks').create).toHaveBeenCalledWith([
        {
          bookId: '123e4567-e89b-12d3-a456-111111111111',
          libraryId: '123e4567-e89b-12d3-a456-222222222222',
        },
      ]);
      expect(services.permissions.can).toHaveBeenCalledWith(context, 'edit:books');
      expect(context.response.status).toEqual(HttpCode.NoContent);
    });
  });
});
