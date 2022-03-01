import {
  Aggregator,
  Operator,
  Page,
  PaginatedFilter,
  PrimitiveTypes,
  Sort,
  ValidationError,
} from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';

import * as factories from '../../__factories__';
import { HttpCode } from '../../../src/types';
import DissociateDeleteRoute from '../../../src/routes/modification/dissociate-delete-related';

export const setupWithManyToManyRelation = () => {
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
          originRelation: 'myLibrary',
          targetRelation: 'myBook',
          foreignCollection: 'books',
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
        }),
        myLibrary: factories.manyToOneSchema.build({
          foreignCollection: 'libraries',
          foreignKey: 'libraryId',
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
          originRelation: 'myBook',
          targetRelation: 'myLibrary',
          foreignCollection: 'libraries',
        }),
      },
    }),
  });
  const dataSource = factories.dataSource.buildWithCollections([librariesBooks, books, libraries]);

  return {
    dataSource,
    services,
    options,
    router,
  };
};

export const setupWithOneToManyRelation = () => {
  const services = factories.forestAdminHttpDriverServices.build();
  const options = factories.forestAdminHttpDriverOptions.build();
  const router = factories.router.mockAllMethods().build();

  const bookPersons = factories.collection.build({
    name: 'bookPersons',
    schema: factories.collectionSchema.build({
      fields: {
        id: factories.columnSchema.isPrimaryKey().build(),
        bookId: factories.columnSchema.build({
          columnType: PrimitiveTypes.Uuid,
        }),
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
          foreignKey: 'bookId',
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

describe('DissociateDeleteRelatedRoute', () => {
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
        query: {
          timezone: 'Europe/Paris',
        },
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
          aggregator: 'and',
          conditions: [
            { field: 'id', operator: 'equal', value: '123e4567-e89b-12d3-a456-426614174000' },
          ],
        }),
      };
      const customProperties = {
        query: {
          ...conditionTreeParams,
          segment: 'a-valid-segment',
          timezone: 'Europe/Paris',
        },
        params: { parentId: '123e4567-e89b-12d3-a456-426614174088' },
      };
      const requestBody = {
        data: [{ id: '123e4567-e89b-12d3-a456-426614174000' }],
      };
      const context = createMockContext({ customProperties, requestBody });

      const scopeCondition = factories.conditionTreeLeaf.build();
      services.permissions.getScope = jest.fn().mockResolvedValue(scopeCondition);

      await count.handleDissociateDeleteRelatedRoute(context);

      expect(dataSource.getCollection('bookPersons').update).toHaveBeenCalledWith(
        new PaginatedFilter({
          conditionTree: factories.conditionTreeBranch.build({
            aggregator: Aggregator.And,
            conditions: expect.arrayContaining([
              scopeCondition,
              factories.conditionTreeLeaf.build({
                operator: Operator.Equal,
                value: '123e4567-e89b-12d3-a456-426614174000',
                field: 'id',
              }),
            ]),
          }),
          segment: 'a-valid-segment',
          timezone: 'Europe/Paris',
          page: new Page(0, 15),
          sort: new Sort({ field: 'id', ascending: true }),
        }),
        expect.any(Object),
      );
      expect(context.response.status).toEqual(HttpCode.NoContent);
    });
  });
});
