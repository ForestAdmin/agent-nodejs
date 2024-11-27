import { allowedOperatorsForColumnType } from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';

import Capabilities from '../../src/routes/capabilities';
import * as factories from '../__factories__';

describe('Capabilities', () => {
  const defaultContext = {
    state: { user: { email: 'john.doe@domain.com' } },
    customProperties: { query: { timezone: 'Europe/Paris' } },
  };
  const options = factories.forestAdminHttpDriverOptions.build();
  const router = factories.router.mockAllMethods().build();
  const services = factories.forestAdminHttpDriverServices.build();

  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('should register "/_internal/capabilities" route', () => {
    const dataSource = factories.dataSource.buildWithCollection(
      factories.collection.build({ name: 'books' }),
    );
    const route = new Capabilities(services, options, dataSource);
    route.setupRoutes(router);

    expect(router.post).toHaveBeenCalledWith('/_internal/capabilities', expect.any(Function));
  });

  describe('with the route mounted', () => {
    let route: Capabilities;
    beforeEach(() => {
      const dataSource = factories.dataSource.buildWithCollection(
        factories.collection.build({
          name: 'books',
          schema: factories.collectionSchema.build({
            fields: {
              id: factories.columnSchema.uuidPrimaryKey().build(),
              name: factories.columnSchema.text().build(),
              publishedAt: factories.columnSchema.build({
                columnType: 'Date',
                filterOperators: new Set(allowedOperatorsForColumnType.Date),
              }),
              price: factories.columnSchema.build({
                columnType: 'Number',
                filterOperators: new Set(allowedOperatorsForColumnType.Number),
              }),
            },
          }),
        }),
      );
      route = new Capabilities(services, options, dataSource);
    });

    describe('when datasource has nativeQueryConnections registered', () => {
      it('should return the available connection names', async () => {
        const context = createMockContext({
          ...defaultContext,
          requestBody: { collectionNames: [] },
        });
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        jest.replaceProperty(route.dataSource, 'nativeQueryConnections', { main: {}, replica: {} });

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        await route.fetchCapabilities(context);

        expect(context.response.body).toEqual({
          nativeQueryConnections: [{ name: 'main' }, { name: 'replica' }],
          collections: [],
        });
      });
    });

    describe('when request body does not list any collection name', () => {
      test('should return nothing', async () => {
        const context = createMockContext({
          ...defaultContext,
          requestBody: { collectionNames: [] },
        });

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        await route.fetchCapabilities(context);

        expect(context.response.body).toEqual({
          nativeQueryConnections: [],
          collections: [],
        });
      });

      test('should handle empty body', async () => {
        const context = createMockContext({
          ...defaultContext,
          requestBody: {},
        });

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        await route.fetchCapabilities(context);

        expect(context.response.body).toEqual({
          nativeQueryConnections: [],
          collections: [],
        });
      });
    });

    describe('when requesting a collection capabilities', () => {
      test('should return the capabilities', async () => {
        const context = createMockContext({
          ...defaultContext,
          requestBody: { collectionNames: ['books'] },
        });

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        await route.fetchCapabilities(context);

        expect(context.response.body).toEqual({
          nativeQueryConnections: [],
          collections: [
            {
              name: 'books',
              fields: [
                {
                  name: 'id',
                  type: 'Uuid',
                  operators: [
                    'blank',
                    'equal',
                    'missing',
                    'not_equal',
                    'present',
                    'in',
                    'not_in',
                    'includes_all',
                    'includes_none',
                  ],
                },
                {
                  name: 'name',
                  type: 'String',
                  operators: [
                    'blank',
                    'equal',
                    'missing',
                    'not_equal',
                    'present',
                    'in',
                    'not_in',
                    'includes_all',
                    'includes_none',
                    'contains',
                    'not_contains',
                    'ends_with',
                    'starts_with',
                    'longer_than',
                    'shorter_than',
                    'like',
                    'i_like',
                    'i_contains',
                    'not_i_contains',
                    'i_ends_with',
                    'i_starts_with',
                  ],
                },
                {
                  name: 'publishedAt',
                  type: 'Date',
                  operators: [
                    'blank',
                    'equal',
                    'missing',
                    'not_equal',
                    'present',
                    'today',
                    'yesterday',
                    'previous_x_days_to_date',
                    'previous_week',
                    'previous_week_to_date',
                    'previous_month',
                    'previous_month_to_date',
                    'previous_quarter',
                    'previous_quarter_to_date',
                    'previous_year',
                    'previous_year_to_date',
                    'past',
                    'future',
                    'previous_x_days',
                    'before',
                    'after',
                    'before_x_hours_ago',
                    'after_x_hours_ago',
                  ],
                },
                {
                  name: 'price',
                  type: 'Number',
                  operators: [
                    'blank',
                    'equal',
                    'missing',
                    'not_equal',
                    'present',
                    'in',
                    'not_in',
                    'includes_all',
                    'includes_none',
                    'greater_than',
                    'less_than',
                    'greater_than_or_equal',
                    'less_than_or_equal',
                  ],
                },
              ],
            },
          ],
        });
      });
    });
  });
});
