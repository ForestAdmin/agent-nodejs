import { Filter, ValidationError } from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';

import * as factories from '../../__factories__';
import { HttpCode } from '../../../src/types';
import DissociateDeleteRoute from '../../../src/routes/modification/dissociate-delete-related';

describe('DissociateDeleteRelatedRoute', () => {
  const setupWithOneToManyRelation = () => {
    const services = factories.forestAdminHttpDriverServices.build();
    const options = factories.forestAdminHttpDriverOptions.build();
    const router = factories.router.mockAllMethods().build();

    const bookPersons = factories.collection.build({
      name: 'bookPersons',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.uuidPrimaryKey().build(),
          bookId: factories.columnSchema.build({
            columnType: 'Uuid',
          }),
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

    return {
      dataSource,
      services,
      options,
      router,
    };
  };

  test('should register the private route', () => {
    const { services, dataSource, options, router } = setupWithOneToManyRelation();

    const oneToManyRelationName = 'myBookPersons';
    const count = new DissociateDeleteRoute(
      services,
      options,
      dataSource,
      'books',
      oneToManyRelationName,
    );
    count.setupRoutes(router);

    expect(router.delete).toHaveBeenCalledWith(
      '/books/:parentId/relationships/myBookPersons',
      expect.any(Function),
    );
  });

  describe('handleDissociateDeleteRelatedRoute', () => {
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

      return {
        dataSource,
        services,
        options,
        router,
      };
    };

    test('should throw an error when an empty id list is passed', async () => {
      const { services, dataSource, options } = setupWithManyToManyRelation();
      const count = new DissociateDeleteRoute(
        services,
        options,
        dataSource,
        'books',
        'manyToManyRelationField',
      );

      const customProperties = {
        query: { timezone: 'Europe/Paris' },
        params: { parentId: '123e4567-e89b-12d3-a456-426614174088' },
      };
      const requestBody = {
        // no ids
        data: [],
      };
      const context = createMockContext({ customProperties, requestBody });

      await expect(count.handleDissociateDeleteRelatedRoute(context)).rejects.toThrow(
        new ValidationError('Expected no empty id list'),
      );
    });

    test('should generate a right paginated filter', async () => {
      const { services, dataSource, options } = setupWithOneToManyRelation();
      dataSource.getCollection('bookPersons').schema.segments = ['a-valid-segment'];

      const count = new DissociateDeleteRoute(
        services,
        options,
        dataSource,
        'books',
        'myBookPersons',
      );

      const conditionTreeParams = {
        filters: JSON.stringify({
          aggregator: 'And',
          conditions: [
            { field: 'id', operator: 'Equal', value: '123e4567-e89b-12d3-a456-426614174000' },
          ],
        }),
      };
      const customProperties = {
        query: { ...conditionTreeParams, segment: 'a-valid-segment', timezone: 'Europe/Paris' },
        params: { parentId: '123e4567-e89b-12d3-a456-426614174088' },
      };
      const requestBody = {
        data: [{ id: '123e4567-e89b-12d3-a456-426614174000' }],
      };
      const context = createMockContext({
        state: { user: { email: 'john.doe@domain.com' } },
        customProperties,
        requestBody,
      });

      const scopeCondition = factories.conditionTreeLeaf.build();
      services.authorization.getScope = jest.fn().mockResolvedValue(scopeCondition);

      await count.handleDissociateDeleteRelatedRoute(context);

      expect(dataSource.getCollection('bookPersons').update).toHaveBeenCalledWith(
        { email: 'john.doe@domain.com', timezone: 'Europe/Paris' },
        new Filter({
          conditionTree: factories.conditionTreeBranch.build({
            aggregator: 'And',
            conditions: expect.arrayContaining([
              scopeCondition,
              factories.conditionTreeLeaf.build({
                operator: 'Equal',
                value: '123e4567-e89b-12d3-a456-426614174000',
                field: 'id',
              }),
            ]),
          }),
          search: null,
          searchExtended: false,
          segment: 'a-valid-segment',
        }),
        expect.any(Object),
      );
      expect(context.response.status).toEqual(HttpCode.NoContent);
    });

    test('should check that the user is authorized', async () => {
      const { services, dataSource, options } = setupWithOneToManyRelation();
      dataSource.getCollection('bookPersons').schema.segments = ['a-valid-segment'];

      const count = new DissociateDeleteRoute(
        services,
        options,
        dataSource,
        'books',
        'myBookPersons',
      );

      const conditionTreeParams = {
        filters: JSON.stringify({
          aggregator: 'And',
          conditions: [
            { field: 'id', operator: 'Equal', value: '123e4567-e89b-12d3-a456-426614174000' },
          ],
        }),
      };
      const customProperties = {
        query: { ...conditionTreeParams, segment: 'a-valid-segment', timezone: 'Europe/Paris' },
        params: { parentId: '123e4567-e89b-12d3-a456-426614174088' },
      };
      const requestBody = {
        data: [{ id: '123e4567-e89b-12d3-a456-426614174000' }],
      };
      const context = createMockContext({
        state: { user: { email: 'john.doe@domain.com' } },
        customProperties,
        requestBody,
      });

      const scopeCondition = factories.conditionTreeLeaf.build();
      services.authorization.getScope = jest.fn().mockResolvedValue(scopeCondition);

      await count.handleDissociateDeleteRelatedRoute(context);

      expect(services.authorization.assertCanDelete).toHaveBeenCalledWith(context, 'books');
    });
  });
});
