import {
  Aggregator,
  ConditionTreeBranch,
  ConditionTreeLeaf,
  Operator,
  Page,
  PaginatedFilter,
  Sort,
} from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';

import * as factories from '../__factories__';
import ContextFilterFactory from '../../../src/agent/utils/context-filter-factory';

describe('FilterFactory', () => {
  describe('buildPaginated', () => {
    const setupContextWithAllFeatures = () => {
      const collection = factories.collection.build({
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.isPrimaryKey().build(),
          },
          segments: ['a-valid-segment'],
        }),
      });

      const context = createMockContext({
        customProperties: {
          query: {
            timezone: 'Europe/Paris',
            search: 'searched argument',
            segment: 'a-valid-segment',
            field: 'id',
            ascending: true,
            'page[size]': 10,
            'page[number]': 3,
            filters: JSON.stringify({
              aggregator: 'and',
              conditions: [
                { field: 'id', operator: 'equal', value: '123e4567-e89b-12d3-a456-426614174000' },
              ],
            }),
            searchExtended: true,
          },
        },
      });

      const scope = factories.conditionTreeLeaf.build({
        operator: Operator.Equal,
        value: '123e4567-e89b-12d3-a456-222222222222',
        field: 'id',
      });

      return { context, collection, scope };
    };

    test('should build a paginated filter from a given context', () => {
      const { context, collection, scope } = setupContextWithAllFeatures();

      const filter = ContextFilterFactory.buildPaginated(collection, context, scope);

      expect(filter).toEqual(
        new PaginatedFilter({
          conditionTree: new ConditionTreeBranch(Aggregator.And, [
            new ConditionTreeLeaf('id', Operator.Equal, '123e4567-e89b-12d3-a456-426614174000'),
            new ConditionTreeLeaf('id', Operator.Equal, '123e4567-e89b-12d3-a456-222222222222'),
          ]),
          timezone: 'Europe/Paris',
          search: 'searched argument',
          sort: new Sort({ field: 'id', ascending: true }),
          page: new Page(20, 10),
          searchExtended: true,
          segment: 'a-valid-segment',
        }),
      );
    });

    test('should build a paginated filter with override params', () => {
      const { context, collection, scope } = setupContextWithAllFeatures();

      const filter = ContextFilterFactory.buildPaginated(collection, context, scope, {
        conditionTree: null,
      });

      expect(filter).toEqual(
        new PaginatedFilter({
          conditionTree: null,

          timezone: 'Europe/Paris',
          search: 'searched argument',
          sort: new Sort({ field: 'id', ascending: true }),
          page: new Page(20, 10),
          searchExtended: true,
          segment: 'a-valid-segment',
        }),
      );
    });
  });
});
