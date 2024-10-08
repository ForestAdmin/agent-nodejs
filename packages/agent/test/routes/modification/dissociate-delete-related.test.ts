import { Filter, PaginatedFilter } from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';

import DissociateDeleteRoute from '../../../src/routes/modification/dissociate-delete-related';
import { HttpCode } from '../../../src/types';
import * as factories from '../../__factories__';

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

  describe('DissociateDeleteRelatedRoute > dissociate', () => {
    describe('when it is a one to many relation', () => {
      test('should update the foreign key in the foreign collection', async () => {
        const { services, dataSource, options } = setupWithOneToManyRelation();

        const count = new DissociateDeleteRoute(
          services,
          options,
          dataSource,
          'books',
          'myBookPersons',
        );

        const customProperties = {
          query: { timezone: 'Europe/Paris' },
          params: { parentId: '123e4567-e89b-12d3-a456-426614174088' },
        };
        const requestBody = {
          data: [
            { id: '123e4567-e89b-12d3-a456-426614174001' },
            { id: '123e4567-e89b-12d3-a456-426614174000' },
          ],
        };
        const context = createMockContext({
          state: { user: { email: 'john.doe@domain.com' } },
          customProperties,
          requestBody,
        });
        await count.handleDissociateDeleteRelatedRoute(context);

        expect(dataSource.getCollection('bookPersons').update).toHaveBeenCalledWith(
          { email: 'john.doe@domain.com', requestId: expect.any(String), timezone: 'Europe/Paris' },
          new PaginatedFilter({
            conditionTree: factories.conditionTreeBranch.build({
              aggregator: 'And',
              conditions: [
                factories.conditionTreeLeaf.build({
                  operator: 'In',
                  value: [
                    '123e4567-e89b-12d3-a456-426614174001',
                    '123e4567-e89b-12d3-a456-426614174000',
                  ],
                  field: 'id',
                }),
                factories.conditionTreeLeaf.build({
                  operator: 'Equal',
                  value: '123e4567-e89b-12d3-a456-426614174088',
                  field: 'bookId',
                }),
              ],
            }),
            search: null,
            searchExtended: false,
            segment: null,
          }),
          { bookId: null },
        );
        expect(context.response.status).toEqual(HttpCode.NoContent);
        expect(services.authorization.assertCanEdit).toHaveBeenCalledWith(context, 'bookPersons');
      });

      describe('when all records mode is activated', () => {
        test('should update the foreign key to the foreign relation except excluded id', async () => {
          const { services, dataSource, options } = setupWithOneToManyRelation();

          const count = new DissociateDeleteRoute(
            services,
            options,
            dataSource,
            'books',
            'myBookPersons',
          );

          const customProperties = {
            query: { timezone: 'Europe/Paris' },
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
          const context = createMockContext({
            state: { user: { email: 'john.doe@domain.com' } },
            customProperties,
            requestBody,
          });
          await count.handleDissociateDeleteRelatedRoute(context);

          expect(dataSource.getCollection('bookPersons').update).toHaveBeenCalledWith(
            {
              email: 'john.doe@domain.com',
              requestId: expect.any(String),
              timezone: 'Europe/Paris',
            },
            new PaginatedFilter({
              conditionTree: factories.conditionTreeBranch.build({
                aggregator: 'And',
                conditions: [
                  factories.conditionTreeLeaf.build({
                    operator: 'NotIn',
                    value: [
                      '123e4567-e89b-12d3-a456-426614174001',
                      '123e4567-e89b-12d3-a456-426614174002',
                    ],
                    field: 'id',
                  }),
                  factories.conditionTreeLeaf.build({
                    operator: 'Equal',
                    value: '123e4567-e89b-12d3-a456-426614174088',
                    field: 'bookId',
                  }),
                ],
              }),
              search: null,
              searchExtended: false,
              segment: null,
            }),
            { bookId: null },
          );
          expect(context.response.status).toEqual(HttpCode.NoContent);
        });

        describe('when there are no excluded ids', () => {
          test('should update all the related foreign key to the foreign relation', async () => {
            const { services, dataSource, options } = setupWithOneToManyRelation();

            const count = new DissociateDeleteRoute(
              services,
              options,
              dataSource,
              'books',
              'myBookPersons',
            );

            const customProperties = {
              query: { timezone: 'Europe/Paris' },
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
            const context = createMockContext({
              state: { user: { email: 'john.doe@domain.com' } },
              customProperties,
              requestBody,
            });
            await count.handleDissociateDeleteRelatedRoute(context);

            expect(dataSource.getCollection('bookPersons').update).toHaveBeenCalledWith(
              {
                email: 'john.doe@domain.com',
                requestId: expect.any(String),
                timezone: 'Europe/Paris',
              },
              new PaginatedFilter({
                conditionTree: factories.conditionTreeLeaf.build({
                  operator: 'Equal',
                  value: '123e4567-e89b-12d3-a456-426614174088',
                  field: 'bookId',
                }),
                search: null,
                searchExtended: false,
                segment: null,
              }),
              { bookId: null },
            );
            expect(context.response.status).toEqual(HttpCode.NoContent);
          });
        });
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

        return {
          dataSource,
          services,
          options,
          router,
        };
      };

      test('removes the records in the many to many collection', async () => {
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
          data: [
            { id: '123e4567-e89b-12d3-a456-426614174001' },
            { id: '123e4567-e89b-12d3-a456-426614174000' },
          ],
        };
        const context = createMockContext({
          state: { user: { email: 'john.doe@domain.com' } },
          customProperties,
          requestBody,
        });
        await count.handleDissociateDeleteRelatedRoute(context);

        expect(dataSource.getCollection('librariesBooks').delete).toHaveBeenCalledWith(
          { email: 'john.doe@domain.com', requestId: expect.any(String), timezone: 'Europe/Paris' },
          new Filter({
            conditionTree: factories.conditionTreeBranch.build({
              aggregator: 'And',
              conditions: [
                factories.conditionTreeLeaf.build({
                  operator: 'Equal',
                  value: '123e4567-e89b-12d3-a456-426614174088',
                  field: 'bookId',
                }),
                factories.conditionTreeLeaf.build({
                  operator: 'In',
                  value: [
                    '123e4567-e89b-12d3-a456-426614174001',
                    '123e4567-e89b-12d3-a456-426614174000',
                  ],
                  field: 'myLibrary:id',
                }),
                factories.conditionTreeLeaf.build({ operator: 'Present', field: 'libraryId' }),
              ],
            }),
            search: null,
            searchExtended: false,
            segment: null,
          }),
        );
        expect(context.response.status).toEqual(HttpCode.NoContent);
      });

      describe('when the given ids should be excluded', () => {
        test('should remove all the related records except excluded records', async () => {
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
          const context = createMockContext({
            state: { user: { email: 'john.doe@domain.com' } },
            customProperties,
            requestBody,
          });
          await count.handleDissociateDeleteRelatedRoute(context);

          expect(dataSource.getCollection('librariesBooks').delete).toHaveBeenCalledWith(
            {
              email: 'john.doe@domain.com',
              requestId: expect.any(String),
              timezone: 'Europe/Paris',
            },
            new Filter({
              conditionTree: factories.conditionTreeBranch.build({
                aggregator: 'And',
                conditions: [
                  factories.conditionTreeLeaf.build({
                    operator: 'Equal',
                    value: '123e4567-e89b-12d3-a456-426614174088',
                    field: 'bookId',
                  }),
                  factories.conditionTreeLeaf.build({
                    operator: 'NotIn',
                    value: [
                      '123e4567-e89b-12d3-a456-426614174001',
                      '123e4567-e89b-12d3-a456-426614174002',
                    ],
                    field: 'myLibrary:id',
                  }),
                  factories.conditionTreeLeaf.build({ operator: 'Present', field: 'libraryId' }),
                ],
              }),
              search: null,
              searchExtended: false,
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
              'books',
              'manyToManyRelationField',
            );

            const customProperties = {
              query: { timezone: 'Europe/Paris' },
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
            const context = createMockContext({
              state: { user: { email: 'john.doe@domain.com' } },
              customProperties,
              requestBody,
            });
            await count.handleDissociateDeleteRelatedRoute(context);

            expect(dataSource.getCollection('librariesBooks').delete).toHaveBeenCalledWith(
              {
                email: 'john.doe@domain.com',
                requestId: expect.any(String),
                timezone: 'Europe/Paris',
              },
              new Filter({
                conditionTree: factories.conditionTreeBranch.build({
                  aggregator: 'And',
                  conditions: [
                    factories.conditionTreeLeaf.build({
                      operator: 'Equal',
                      value: '123e4567-e89b-12d3-a456-426614174088',
                      field: 'bookId',
                    }),
                    factories.conditionTreeLeaf.build({ field: 'libraryId', operator: 'Present' }),
                  ],
                }),
                search: null,
                searchExtended: false,
                segment: null,
              }),
            );
            expect(context.response.status).toEqual(HttpCode.NoContent);
          });
        });
      });
    });

    describe('with special characters in names', () => {
      it('should register routes with escaped names', () => {
        const services = factories.forestAdminHttpDriverServices.build();
        const options = factories.forestAdminHttpDriverOptions.build();
        const router = factories.router.mockAllMethods().build();

        const bookPersons = factories.collection.build({
          name: 'bookPersons+*?',
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
          name: 'books+*?',
          schema: factories.collectionSchema.build({
            fields: {
              id: factories.columnSchema.uuidPrimaryKey().build(),
              myBookPersons: factories.oneToManySchema.build({
                foreignCollection: 'bookPersons+*?',
                originKey: 'bookId',
                originKeyTarget: 'id',
              }),
            },
          }),
        });
        const dataSource = factories.dataSource.buildWithCollections([bookPersons, books]);

        const count = new DissociateDeleteRoute(
          services,
          options,
          dataSource,
          'books+*?',
          'myBookPersons+*?',
        );

        count.setupRoutes(router);

        expect(router.delete).toHaveBeenCalledWith(
          '/books\\+\\*\\?/:parentId/relationships/myBookPersons\\+\\*\\?',
          expect.any(Function),
        );
      });
    });
  });

  describe('DissociateDeleteRelatedRoute > delete', () => {
    describe('when it is a one to many relation', () => {
      test('should remove the related records', async () => {
        const { services, dataSource, options } = setupWithOneToManyRelation();

        const count = new DissociateDeleteRoute(
          services,
          options,
          dataSource,
          'books',
          'myBookPersons',
        );

        const context = createMockContext({
          state: { user: { email: 'john.doe@domain.com' } },
          customProperties: {
            query: { delete: true, timezone: 'Europe/Paris' },
            params: { parentId: '123e4567-e89b-12d3-a456-426614174088' },
          },
          requestBody: {
            data: [
              { id: '123e4567-e89b-12d3-a456-426614174001' },
              { id: '123e4567-e89b-12d3-a456-426614174000' },
            ],
          },
        });

        await count.handleDissociateDeleteRelatedRoute(context);

        expect(dataSource.getCollection('bookPersons').delete).toHaveBeenCalledWith(
          { email: 'john.doe@domain.com', requestId: expect.any(String), timezone: 'Europe/Paris' },
          new Filter({
            conditionTree: factories.conditionTreeBranch.build({
              aggregator: 'And',
              conditions: [
                factories.conditionTreeLeaf.build({
                  operator: 'In',
                  value: [
                    '123e4567-e89b-12d3-a456-426614174001',
                    '123e4567-e89b-12d3-a456-426614174000',
                  ],
                  field: 'id',
                }),
                factories.conditionTreeLeaf.build({
                  operator: 'Equal',
                  value: '123e4567-e89b-12d3-a456-426614174088',
                  field: 'bookId',
                }),
              ],
            }),
            search: null,
            searchExtended: false,
            segment: null,
          }),
        );
        expect(context.response.status).toEqual(HttpCode.NoContent);
        expect(services.authorization.assertCanDelete).toHaveBeenCalledWith(context, 'bookPersons');
      });

      describe('when all records mode is activated', () => {
        test('should remove the related records except excluded id', async () => {
          const { services, dataSource, options } = setupWithOneToManyRelation();

          const count = new DissociateDeleteRoute(
            services,
            options,
            dataSource,
            'books',
            'myBookPersons',
          );

          const context = createMockContext({
            state: { user: { email: 'john.doe@domain.com' } },
            customProperties: {
              query: { delete: true, timezone: 'Europe/Paris' },
              params: { parentId: '123e4567-e89b-12d3-a456-426614174088' },
            },
            requestBody: {
              data: {
                attributes: {
                  all_records: true,
                  all_records_ids_excluded: [
                    '123e4567-e89b-12d3-a456-426614174001',
                    '123e4567-e89b-12d3-a456-426614174002',
                  ],
                },
              },
            },
          });
          await count.handleDissociateDeleteRelatedRoute(context);

          expect(dataSource.getCollection('bookPersons').delete).toHaveBeenCalledWith(
            {
              email: 'john.doe@domain.com',
              requestId: expect.any(String),
              timezone: 'Europe/Paris',
            },
            new Filter({
              conditionTree: factories.conditionTreeBranch.build({
                aggregator: 'And',
                conditions: [
                  factories.conditionTreeLeaf.build({
                    operator: 'NotIn',
                    value: [
                      '123e4567-e89b-12d3-a456-426614174001',
                      '123e4567-e89b-12d3-a456-426614174002',
                    ],
                    field: 'id',
                  }),
                  factories.conditionTreeLeaf.build({
                    operator: 'Equal',
                    value: '123e4567-e89b-12d3-a456-426614174088',
                    field: 'bookId',
                  }),
                ],
              }),
              search: null,
              searchExtended: false,
              segment: null,
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
              'books',
              'myBookPersons',
            );

            const context = createMockContext({
              state: { user: { email: 'john.doe@domain.com' } },
              customProperties: {
                query: { delete: true, timezone: 'Europe/Paris' },
                params: { parentId: '123e4567-e89b-12d3-a456-426614174088' },
              },
              requestBody: {
                // no excluded ids
                data: { attributes: { all_records: true, all_records_ids_excluded: [] } },
              },
            });
            await count.handleDissociateDeleteRelatedRoute(context);

            expect(dataSource.getCollection('bookPersons').delete).toHaveBeenCalledWith(
              {
                email: 'john.doe@domain.com',
                requestId: expect.any(String),
                timezone: 'Europe/Paris',
              },
              new Filter({
                conditionTree: factories.conditionTreeLeaf.build({
                  operator: 'Equal',
                  value: '123e4567-e89b-12d3-a456-426614174088',
                  field: 'bookId',
                }),
                search: null,
                searchExtended: false,
                segment: null,
              }),
            );
            expect(context.response.status).toEqual(HttpCode.NoContent);
          });
        });
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

      test('removes the records in the many to many and in the foreign collections', async () => {
        const { services, dataSource, options } = setupWithManyToManyRelation();
        const count = new DissociateDeleteRoute(
          services,
          options,
          dataSource,
          'books',
          'manyToManyRelationField',
        );

        const context = createMockContext({
          state: { user: { email: 'john.doe@domain.com' } },
          customProperties: {
            query: { delete: true, timezone: 'Europe/Paris' },
            params: { parentId: '123e4567-e89b-12d3-a456-426614174088' },
          },
          requestBody: {
            data: [
              { id: '123e4567-e89b-12d3-a456-111111111111' },
              { id: '123e4567-e89b-12d3-a456-222222222222' },
            ],
          },
        });

        dataSource.getCollection('librariesBooks').list = jest
          .fn()
          .mockReturnValue([{ libraryId: '123e4567-e89b-12d3-a456-000000000000' }]);

        await count.handleDissociateDeleteRelatedRoute(context);

        expect(dataSource.getCollection('librariesBooks').delete).toHaveBeenCalledWith(
          { email: 'john.doe@domain.com', requestId: expect.any(String), timezone: 'Europe/Paris' },
          new Filter({
            conditionTree: factories.conditionTreeBranch.build({
              aggregator: 'And',
              conditions: [
                factories.conditionTreeLeaf.build({
                  operator: 'Equal',
                  value: '123e4567-e89b-12d3-a456-426614174088',
                  field: 'bookId',
                }),
                factories.conditionTreeLeaf.build({
                  operator: 'In',
                  value: [
                    '123e4567-e89b-12d3-a456-111111111111',
                    '123e4567-e89b-12d3-a456-222222222222',
                  ],
                  field: 'myLibrary:id',
                }),
                factories.conditionTreeLeaf.build({ operator: 'Present', field: 'libraryId' }),
              ],
            }),
            search: null,
            searchExtended: false,
            segment: null,
          }),
        );

        expect(dataSource.getCollection('libraries').delete).toHaveBeenCalledWith(
          { email: 'john.doe@domain.com', requestId: expect.any(String), timezone: 'Europe/Paris' },
          new Filter({
            conditionTree: factories.conditionTreeBranch.build({
              aggregator: 'And',
              conditions: [
                // user selection
                factories.conditionTreeLeaf.build({
                  operator: 'In',
                  value: [
                    '123e4567-e89b-12d3-a456-111111111111',
                    '123e4567-e89b-12d3-a456-222222222222',
                  ],
                  field: 'id',
                }),

                // parent-child restriction (on a related data context)
                factories.conditionTreeLeaf.build({
                  operator: 'In',
                  value: ['123e4567-e89b-12d3-a456-000000000000'],
                  field: 'id',
                }),
              ],
            }),
            search: null,
            searchExtended: false,
            segment: null,
          }),
        );
        expect(context.response.status).toEqual(HttpCode.NoContent);
        expect(services.authorization.assertCanDelete).toHaveBeenCalledWith(context, 'libraries');
      });

      describe('when the given ids should be excluded', () => {
        test('should remove all the related records except excluded records', async () => {
          const { services, dataSource, options } = setupWithManyToManyRelation();

          const count = new DissociateDeleteRoute(
            services,
            options,
            dataSource,
            'books',
            'manyToManyRelationField',
          );

          const deleteParams = { delete: true };
          const customProperties = {
            query: { ...deleteParams, timezone: 'Europe/Paris' },
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
          const context = createMockContext({
            state: { user: { email: 'john.doe@domain.com' } },
            customProperties,
            requestBody,
          });

          const idsToRemove = [
            { libraryId: '123e4567-e89b-12d3-a456-426614174008' },
            { libraryId: '123e4567-e89b-12d3-a456-426614174009' },
          ];
          dataSource.getCollection('librariesBooks').list = jest.fn().mockReturnValue(idsToRemove);

          await count.handleDissociateDeleteRelatedRoute(context);

          expect(dataSource.getCollection('librariesBooks').delete).toHaveBeenCalledWith(
            {
              email: 'john.doe@domain.com',
              requestId: expect.any(String),
              timezone: 'Europe/Paris',
            },
            new Filter({
              conditionTree: factories.conditionTreeBranch.build({
                aggregator: 'And',
                conditions: [
                  factories.conditionTreeLeaf.build({
                    operator: 'Equal',
                    value: '123e4567-e89b-12d3-a456-426614174088',
                    field: 'bookId',
                  }),
                  factories.conditionTreeLeaf.build({
                    operator: 'NotIn',
                    value: [
                      '123e4567-e89b-12d3-a456-426614174001',
                      '123e4567-e89b-12d3-a456-426614174002',
                    ],
                    field: 'myLibrary:id',
                  }),
                  factories.conditionTreeLeaf.build({ operator: 'Present', field: 'libraryId' }),
                ],
              }),
              search: null,
              searchExtended: false,
              segment: null,
            }),
          );

          expect(dataSource.getCollection('libraries').delete).toHaveBeenCalledWith(
            {
              email: 'john.doe@domain.com',
              requestId: expect.any(String),
              timezone: 'Europe/Paris',
            },
            new Filter({
              conditionTree: factories.conditionTreeBranch.build({
                aggregator: 'And',
                conditions: [
                  // remove only selected ids
                  factories.conditionTreeLeaf.build({
                    operator: 'NotIn',
                    value: [
                      '123e4567-e89b-12d3-a456-426614174001',
                      '123e4567-e89b-12d3-a456-426614174002',
                    ],
                    field: 'id',
                  }),

                  // remove only children of the parent record
                  factories.conditionTreeLeaf.build({
                    operator: 'In',
                    value: idsToRemove.map(r => r.libraryId),
                    field: 'id',
                  }),
                ],
              }),
              search: null,
              searchExtended: false,
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
              'books',
              'manyToManyRelationField',
            );

            const deleteParams = { delete: true };
            const customProperties = {
              query: { ...deleteParams, timezone: 'Europe/Paris' },
              params: { parentId: '123e4567-e89b-12d3-a456-426614174088' },
            };
            const requestBody = {
              // empty excluded records
              data: { attributes: { all_records: true, all_records_ids_excluded: [] } },
            };
            const context = createMockContext({
              state: { user: { email: 'john.doe@domain.com' } },
              customProperties,
              requestBody,
            });

            const idsToRemove = [
              { libraryId: '123e4567-e89b-12d3-a456-426614174008' },
              { libraryId: '123e4567-e89b-12d3-a456-426614174009' },
            ];
            dataSource.getCollection('librariesBooks').list = jest
              .fn()
              .mockReturnValue(idsToRemove);

            await count.handleDissociateDeleteRelatedRoute(context);

            expect(dataSource.getCollection('librariesBooks').delete).toHaveBeenCalledWith(
              {
                email: 'john.doe@domain.com',
                requestId: expect.any(String),
                timezone: 'Europe/Paris',
              },
              new Filter({
                conditionTree: factories.conditionTreeBranch.build({
                  aggregator: 'And',
                  conditions: [
                    factories.conditionTreeLeaf.build({
                      operator: 'Equal',
                      value: '123e4567-e89b-12d3-a456-426614174088',
                      field: 'bookId',
                    }),
                    factories.conditionTreeLeaf.build({ operator: 'Present', field: 'libraryId' }),
                  ],
                }),
                search: null,
                searchExtended: false,
                segment: null,
              }),
            );

            expect(dataSource.getCollection('libraries').delete).toHaveBeenCalledWith(
              {
                email: 'john.doe@domain.com',
                requestId: expect.any(String),
                timezone: 'Europe/Paris',
              },
              new Filter({
                conditionTree: factories.conditionTreeLeaf.build({
                  operator: 'In',
                  value: idsToRemove.map(r => r.libraryId),
                  field: 'id',
                }),
                search: null,
                searchExtended: false,
                segment: null,
              }),
            );

            expect(context.response.status).toEqual(HttpCode.NoContent);
          });
        });
      });
    });
  });

  describe('with special characters in names', () => {
    it('should register routes with escaped names', () => {
      const services = factories.forestAdminHttpDriverServices.build();
      const options = factories.forestAdminHttpDriverOptions.build();
      const router = factories.router.mockAllMethods().build();

      const bookPersons = factories.collection.build({
        name: 'bookPersons+*?',
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
        name: 'books+*?',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.uuidPrimaryKey().build(),
            myBookPersons: factories.oneToManySchema.build({
              foreignCollection: 'bookPersons+*?',
              originKey: 'bookId',
              originKeyTarget: 'id',
            }),
          },
        }),
      });
      const dataSource = factories.dataSource.buildWithCollections([bookPersons, books]);

      const count = new DissociateDeleteRoute(
        services,
        options,
        dataSource,
        'books+*?',
        'myBookPersons+*?',
      );

      count.setupRoutes(router);

      expect(router.delete).toHaveBeenCalledWith(
        '/books\\+\\*\\?/:parentId/relationships/myBookPersons\\+\\*\\?',
        expect.any(Function),
      );
    });
  });
});
