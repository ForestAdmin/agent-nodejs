import { Aggregator, Filter, Operator, PrimitiveTypes } from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';

import * as factories from '../../__factories__';
import { HttpCode } from '../../../src/types';
import DissociateDeleteRoute from '../../../src/routes/modification/dissociate-delete-related';

describe('DissociateDeleteRelatedRoute > delete', () => {
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

  const setupWithOneToManyRelation = () => {
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

  describe('when it is a one to many relation', () => {
    test('should remove the related records', async () => {
      const { services, dataSource, options } = setupWithOneToManyRelation();
      dataSource.getCollection('bookPersons').schema.segments = ['a-valid-segment'];

      const count = new DissociateDeleteRoute(
        services,
        options,
        dataSource,
        dataSource.getCollection('books').name,
        'myBookPersons',
      );

      const deleteParams = { delete: true };
      const conditionTreeParams = {
        filters: JSON.stringify({
          aggregator: 'and',
          conditions: [
            { field: 'id', operator: 'equal', value: '123e4567-e89b-12d3-a456-426614174000' },
          ],
        }),
      };
      const segmentParams = { segment: 'a-valid-segment' };
      const customProperties = {
        query: {
          ...deleteParams,
          ...conditionTreeParams,
          ...segmentParams,
          timezone: 'Europe/Paris',
        },
        params: { parentId: '123e4567-e89b-12d3-a456-426614174088' },
      };
      const requestBody = {
        data: [
          { id: '123e4567-e89b-12d3-a456-426614174001' },
          { id: '123e4567-e89b-12d3-a456-426614174000' },
        ],
      };
      const context = createMockContext({ customProperties, requestBody });
      await count.handleDissociateDeleteRelatedRoute(context);

      expect(dataSource.getCollection('bookPersons').delete).toHaveBeenCalledWith(
        new Filter({
          conditionTree: factories.conditionTreeBranch.build({
            aggregator: Aggregator.And,
            conditions: [
              factories.conditionTreeLeaf.build({
                operator: Operator.Equal,
                value: '123e4567-e89b-12d3-a456-426614174000',
                field: 'id',
              }),
              factories.conditionTreeLeaf.build({
                operator: Operator.In,
                value: [
                  '123e4567-e89b-12d3-a456-426614174001',
                  '123e4567-e89b-12d3-a456-426614174000',
                ],
                field: 'id',
              }),
              factories.conditionTreeLeaf.build({
                operator: Operator.Equal,
                value: '123e4567-e89b-12d3-a456-426614174088',
                field: 'bookId',
              }),
            ],
          }),
          segment: 'a-valid-segment',
          timezone: 'Europe/Paris',
        }),
      );
      expect(context.response.status).toEqual(HttpCode.NoContent);
    });

    describe('when all records mode is activated', () => {
      test('should remove the related records except excluded id', async () => {
        const { services, dataSource, options } = setupWithOneToManyRelation();

        const count = new DissociateDeleteRoute(
          services,
          options,
          dataSource,
          dataSource.getCollection('books').name,
          'myBookPersons',
        );

        const deleteParams = { delete: true };
        const customProperties = {
          query: {
            ...deleteParams,
            timezone: 'Europe/Paris',
          },
          params: { parentId: '123e4567-e89b-12d3-a456-426614174088' },
        };
        const requestBody = {
          data: {
            attributes: {
              all_records: true,
              all_records_ids_excluded: [
                '123e4567-e89b-12d3-a456-426614174001',
                '123e4567-e89b-12d3-a456-426614174002',
              ],
            },
          },
        };
        const context = createMockContext({ customProperties, requestBody });
        await count.handleDissociateDeleteRelatedRoute(context);

        expect(dataSource.getCollection('bookPersons').delete).toHaveBeenCalledWith(
          new Filter({
            conditionTree: factories.conditionTreeBranch.build({
              aggregator: Aggregator.And,
              conditions: [
                factories.conditionTreeLeaf.build({
                  operator: Operator.NotIn,
                  value: [
                    '123e4567-e89b-12d3-a456-426614174001',
                    '123e4567-e89b-12d3-a456-426614174002',
                  ],
                  field: 'id',
                }),
                factories.conditionTreeLeaf.build({
                  operator: Operator.Equal,
                  value: '123e4567-e89b-12d3-a456-426614174088',
                  field: 'bookId',
                }),
              ],
            }),
            segment: null,
            timezone: 'Europe/Paris',
          }),
        );
        expect(context.response.status).toEqual(HttpCode.NoContent);
      });

      describe('when there are no excluded ids', () => {
        test('should remove all the related records', async () => {
          const { services, dataSource, options } = setupWithOneToManyRelation();

          const count = new DissociateDeleteRoute(
            services,
            options,
            dataSource,
            dataSource.getCollection('books').name,
            'myBookPersons',
          );

          const deleteParams = { delete: true };
          const customProperties = {
            query: {
              ...deleteParams,
              timezone: 'Europe/Paris',
            },
            params: { parentId: '123e4567-e89b-12d3-a456-426614174088' },
          };
          const requestBody = {
            data: {
              attributes: {
                all_records: true,
                // no excluded ids
                all_records_ids_excluded: [],
              },
            },
          };
          const context = createMockContext({ customProperties, requestBody });
          await count.handleDissociateDeleteRelatedRoute(context);

          expect(dataSource.getCollection('bookPersons').delete).toHaveBeenCalledWith(
            new Filter({
              conditionTree: factories.conditionTreeLeaf.build({
                operator: Operator.Equal,
                value: '123e4567-e89b-12d3-a456-426614174088',
                field: 'bookId',
              }),
              timezone: 'Europe/Paris',
              segment: null,
            }),
          );
          expect(context.response.status).toEqual(HttpCode.NoContent);
        });
      });
    });
  });

  describe('when it is a many to many relation', () => {
    test('removes the records in the many to many and in the foreign collections', async () => {
      const { services, dataSource, options } = setupWithManyToManyRelation();
      dataSource.getCollection('libraries').schema.segments = ['a-valid-segment'];

      const count = new DissociateDeleteRoute(
        services,
        options,
        dataSource,
        dataSource.getCollection('books').name,
        'manyToManyRelationField',
      );

      const deleteParams = { delete: true };
      const conditionTreeParams = {
        filters: JSON.stringify({
          aggregator: 'and',
          conditions: [
            { field: 'id', operator: 'equal', value: '123e4567-e89b-12d3-a456-426614174000' },
          ],
        }),
      };
      const segmentParams = { segment: 'a-valid-segment' };
      const customProperties = {
        query: {
          ...deleteParams,
          ...conditionTreeParams,
          ...segmentParams,
          timezone: 'Europe/Paris',
        },
        params: { parentId: '123e4567-e89b-12d3-a456-426614174088' },
      };
      const requestBody = {
        data: [
          { id: '123e4567-e89b-12d3-a456-426614174001' },
          { id: '123e4567-e89b-12d3-a456-426614174000' },
        ],
      };
      const context = createMockContext({ customProperties, requestBody });
      await count.handleDissociateDeleteRelatedRoute(context);

      expect(dataSource.getCollection('librariesBooks').delete).toHaveBeenCalledWith(
        new Filter({
          conditionTree: factories.conditionTreeBranch.build({
            aggregator: Aggregator.And,
            conditions: [
              factories.conditionTreeLeaf.build({
                operator: Operator.Equal,
                value: '123e4567-e89b-12d3-a456-426614174000',
                field: 'myLibrary:id',
              }),
              factories.conditionTreeLeaf.build({
                operator: Operator.Equal,
                value: '123e4567-e89b-12d3-a456-426614174088',
                field: 'bookId',
              }),
              factories.conditionTreeLeaf.build({
                operator: Operator.In,
                value: [
                  '123e4567-e89b-12d3-a456-426614174001',
                  '123e4567-e89b-12d3-a456-426614174000',
                ],
                field: 'libraryId',
              }),
            ],
          }),
          segment: 'a-valid-segment',
          timezone: 'Europe/Paris',
        }),
      );

      expect(dataSource.getCollection('libraries').delete).toHaveBeenCalledWith(
        new Filter({
          conditionTree: factories.conditionTreeBranch.build({
            conditions: [
              factories.conditionTreeLeaf.build({
                operator: Operator.Equal,
                value: '123e4567-e89b-12d3-a456-426614174088',
                field: 'manyToManyRelationField:bookId',
              }),
              factories.conditionTreeLeaf.build({
                operator: Operator.In,
                value: [
                  '123e4567-e89b-12d3-a456-426614174001',
                  '123e4567-e89b-12d3-a456-426614174000',
                ],
                field: 'id',
              }),
            ],
          }),
          timezone: 'Europe/Paris',
          segment: 'a-valid-segment',
        }),
      );
      expect(context.response.status).toEqual(HttpCode.NoContent);
    });

    describe('when all records mode is activated', () => {
      test('should remove all the related records except excluded records', async () => {
        const { services, dataSource, options } = setupWithManyToManyRelation();

        const count = new DissociateDeleteRoute(
          services,
          options,
          dataSource,
          dataSource.getCollection('books').name,
          'manyToManyRelationField',
        );

        const deleteParams = { delete: true };
        const customProperties = {
          query: {
            ...deleteParams,
            timezone: 'Europe/Paris',
          },
          params: { parentId: '123e4567-e89b-12d3-a456-426614174088' },
        };
        const requestBody = {
          data: {
            attributes: {
              all_records: true,
              all_records_ids_excluded: [
                '123e4567-e89b-12d3-a456-426614174001',
                '123e4567-e89b-12d3-a456-426614174002',
              ],
            },
          },
        };
        const context = createMockContext({ customProperties, requestBody });
        await count.handleDissociateDeleteRelatedRoute(context);

        expect(dataSource.getCollection('librariesBooks').delete).toHaveBeenCalledWith(
          new Filter({
            conditionTree: factories.conditionTreeBranch.build({
              aggregator: Aggregator.And,
              conditions: [
                factories.conditionTreeLeaf.build({
                  operator: Operator.Equal,
                  value: '123e4567-e89b-12d3-a456-426614174088',
                  field: 'bookId',
                }),
                factories.conditionTreeLeaf.build({
                  operator: Operator.NotIn,
                  value: [
                    '123e4567-e89b-12d3-a456-426614174001',
                    '123e4567-e89b-12d3-a456-426614174002',
                  ],
                  field: 'libraryId',
                }),
              ],
            }),
            segment: null,
            timezone: 'Europe/Paris',
          }),
        );

        expect(dataSource.getCollection('libraries').delete).toHaveBeenCalledWith(
          new Filter({
            conditionTree: factories.conditionTreeBranch.build({
              aggregator: Aggregator.And,
              conditions: [
                factories.conditionTreeLeaf.build({
                  operator: Operator.Equal,
                  value: '123e4567-e89b-12d3-a456-426614174088',
                  field: 'manyToManyRelationField:bookId',
                }),
                factories.conditionTreeLeaf.build({
                  operator: Operator.NotIn,
                  value: [
                    '123e4567-e89b-12d3-a456-426614174001',
                    '123e4567-e89b-12d3-a456-426614174002',
                  ],
                  field: 'id',
                }),
              ],
            }),
            timezone: 'Europe/Paris',
            segment: null,
          }),
        );
        expect(context.response.status).toEqual(HttpCode.NoContent);
      });

      describe('when there are no excluded ids', () => {
        test('should remove all the related records', async () => {
          const { services, dataSource, options } = setupWithManyToManyRelation();
          const count = new DissociateDeleteRoute(
            services,
            options,
            dataSource,
            dataSource.getCollection('books').name,
            'manyToManyRelationField',
          );

          const deleteParams = { delete: true };
          const customProperties = {
            query: {
              ...deleteParams,
              timezone: 'Europe/Paris',
            },
            params: { parentId: '123e4567-e89b-12d3-a456-426614174088' },
          };
          const requestBody = {
            data: {
              attributes: {
                all_records: true,
                // empty excluded records
                all_records_ids_excluded: [],
              },
            },
          };
          const context = createMockContext({ customProperties, requestBody });
          await count.handleDissociateDeleteRelatedRoute(context);

          expect(dataSource.getCollection('librariesBooks').delete).toHaveBeenCalledWith(
            new Filter({
              conditionTree: factories.conditionTreeLeaf.build({
                operator: Operator.Equal,
                value: '123e4567-e89b-12d3-a456-426614174088',
                field: 'bookId',
              }),
              segment: null,
              timezone: 'Europe/Paris',
            }),
          );
          expect(dataSource.getCollection('libraries').delete).toHaveBeenCalledWith(
            new Filter({
              conditionTree: factories.conditionTreeLeaf.build({
                operator: Operator.Equal,
                value: '123e4567-e89b-12d3-a456-426614174088',
                field: 'manyToManyRelationField:bookId',
              }),
              timezone: 'Europe/Paris',
              segment: null,
            }),
          );

          expect(context.response.status).toEqual(HttpCode.NoContent);
        });
      });
    });
  });
});
