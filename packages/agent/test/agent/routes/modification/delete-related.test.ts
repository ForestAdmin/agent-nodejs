import { Aggregator, Filter, Operator } from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';

import * as factories from '../../__factories__';
import { HttpCode } from '../../../../src/agent/types';
import {
  setupWithManyToManyRelation,
  setupWithOneToManyRelation,
} from './dissociate-delete-related.test';
import DissociateDeleteRoute from '../../../../src/agent/routes/modification/dissociate-delete-related';

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

      const deleteParams = { delete: true };
      const customProperties = {
        query: {
          ...deleteParams,
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
          search: null,
          searchExtended: false,
          segment: null,
          timezone: 'Europe/Paris',
        }),
      );
      expect(context.response.status).toEqual(HttpCode.NoContent);
      expect(services.permissions.can).toHaveBeenCalledWith(context, 'delete:bookPersons');
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
            search: null,
            searchExtended: false,
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
            'books',
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
              search: null,
              searchExtended: false,
              segment: null,
              timezone: 'Europe/Paris',
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
      const count = new DissociateDeleteRoute(
        services,
        options,
        dataSource,
        'books',
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
        data: [
          { id: '123e4567-e89b-12d3-a456-111111111111' },
          { id: '123e4567-e89b-12d3-a456-222222222222' },
        ],
      };
      const context = createMockContext({ customProperties, requestBody });

      dataSource.getCollection('librariesBooks').list = jest
        .fn()
        .mockReturnValue([{ libraryId: '123e4567-e89b-12d3-a456-000000000000' }]);

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
                operator: Operator.In,
                value: requestBody.data.map(r => r.id),
                field: 'myLibrary:id',
              }),
            ],
          }),
          search: null,
          searchExtended: false,
          segment: null,
          timezone: 'Europe/Paris',
        }),
      );

      expect(dataSource.getCollection('libraries').delete).toHaveBeenCalledWith(
        new Filter({
          conditionTree: factories.conditionTreeBranch.build({
            aggregator: Aggregator.And,
            conditions: [
              // user selection
              factories.conditionTreeLeaf.build({
                operator: Operator.In,
                value: requestBody.data.map(r => r.id),
                field: 'id',
              }),

              // parent-child restriction (on a related data context)
              factories.conditionTreeLeaf.build({
                operator: Operator.In,
                value: ['123e4567-e89b-12d3-a456-000000000000'],
                field: 'id',
              }),
            ],
          }),
          search: null,
          searchExtended: false,
          segment: null,
          timezone: 'Europe/Paris',
        }),
      );
      expect(context.response.status).toEqual(HttpCode.NoContent);
      expect(services.permissions.can).toHaveBeenCalledWith(context, 'delete:libraries');
      expect(services.permissions.can).toHaveBeenCalledWith(context, 'delete:librariesBooks');
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

        const idsToRemove = [
          { libraryId: '123e4567-e89b-12d3-a456-426614174008' },
          { libraryId: '123e4567-e89b-12d3-a456-426614174009' },
        ];
        dataSource.getCollection('librariesBooks').list = jest.fn().mockReturnValue(idsToRemove);

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
                  field: 'myLibrary:id',
                }),
              ],
            }),
            search: null,
            searchExtended: false,
            segment: null,
            timezone: 'Europe/Paris',
          }),
        );

        expect(dataSource.getCollection('libraries').delete).toHaveBeenCalledWith(
          new Filter({
            conditionTree: factories.conditionTreeBranch.build({
              aggregator: Aggregator.And,
              conditions: [
                // remove only selected ids
                factories.conditionTreeLeaf.build({
                  operator: Operator.NotIn,
                  value: [
                    '123e4567-e89b-12d3-a456-426614174001',
                    '123e4567-e89b-12d3-a456-426614174002',
                  ],
                  field: 'id',
                }),

                // remove only children of the parent record
                factories.conditionTreeLeaf.build({
                  operator: Operator.In,
                  value: idsToRemove.map(r => r.libraryId),
                  field: 'id',
                }),
              ],
            }),
            search: null,
            searchExtended: false,
            segment: null,
            timezone: 'Europe/Paris',
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

          const idsToRemove = [
            { libraryId: '123e4567-e89b-12d3-a456-426614174008' },
            { libraryId: '123e4567-e89b-12d3-a456-426614174009' },
          ];
          dataSource.getCollection('librariesBooks').list = jest.fn().mockReturnValue(idsToRemove);

          await count.handleDissociateDeleteRelatedRoute(context);

          expect(dataSource.getCollection('librariesBooks').delete).toHaveBeenCalledWith(
            new Filter({
              conditionTree: factories.conditionTreeLeaf.build({
                operator: Operator.Equal,
                value: '123e4567-e89b-12d3-a456-426614174088',
                field: 'bookId',
              }),
              search: null,
              searchExtended: false,
              segment: null,
              timezone: 'Europe/Paris',
            }),
          );

          expect(dataSource.getCollection('libraries').delete).toHaveBeenCalledWith(
            new Filter({
              conditionTree: factories.conditionTreeLeaf.build({
                operator: Operator.In,
                value: idsToRemove.map(r => r.libraryId),
                field: 'id',
              }),
              search: null,
              searchExtended: false,
              segment: null,
              timezone: 'Europe/Paris',
            }),
          );

          expect(context.response.status).toEqual(HttpCode.NoContent);
        });
      });
    });
  });
});
