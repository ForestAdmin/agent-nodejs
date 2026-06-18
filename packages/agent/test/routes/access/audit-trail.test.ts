import { createMockContext } from '@shopify/jest-koa-mocks';

import makeRoutes from '../../../src/routes';
import AuditTrailRoute from '../../../src/routes/access/audit-trail';
import * as factories from '../../__factories__';

describe('AuditTrailRoute', () => {
  const setup = (history: unknown[] = []) => {
    const services = factories.forestAdminHttpDriverServices.build();
    const dataSource = factories.dataSource.buildWithCollections([
      factories.collection.build({
        name: 'books',
        schema: factories.collectionSchema.build({
          fields: { id: factories.columnSchema.numericPrimaryKey().build() },
        }),
      }),
    ]);
    const store = { listByRecord: jest.fn().mockResolvedValue(history) };
    const options = factories.forestAdminHttpDriverOptions.build({ auditTrail: { store } });

    return { services, dataSource, options, store };
  };

  test('registers the "/_audit-trail/books/:id" route', () => {
    const { services, dataSource, options } = setup();
    const router = factories.router.mockAllMethods().build();

    new AuditTrailRoute(services, options, dataSource, 'books').setupRoutes(router);

    expect(router.get).toHaveBeenCalledWith('/_audit-trail/books/:id', expect.any(Function));
  });

  test('returns the record history read from the store', async () => {
    const history = [{ operation: 'update', recordId: '2' }];
    const { services, dataSource, options, store } = setup(history);
    const route = new AuditTrailRoute(services, options, dataSource, 'books');
    const context = createMockContext({
      state: { user: { email: 'john.doe@domain.com' } },
      customProperties: { query: { timezone: 'Europe/Paris' }, params: { id: '2' } },
    });

    await route.handleHistory(context);

    expect(store.listByRecord).toHaveBeenCalledWith({
      collection: 'books',
      recordId: '2',
      skip: 0,
      limit: 15,
    });
    expect(context.response.body).toEqual({ data: history });
  });

  test('forwards pagination from page[size]/page[number] to the store', async () => {
    const { services, dataSource, options, store } = setup();
    const route = new AuditTrailRoute(services, options, dataSource, 'books');
    const context = createMockContext({
      state: { user: { email: 'john.doe@domain.com' } },
      customProperties: {
        query: { timezone: 'Europe/Paris', 'page[size]': '10', 'page[number]': '3' },
        params: { id: '2' },
      },
    });

    await route.handleHistory(context);

    expect(store.listByRecord).toHaveBeenCalledWith({
      collection: 'books',
      recordId: '2',
      skip: 20,
      limit: 10,
    });
  });

  test('asserts the user can read the collection before returning history', async () => {
    const { services, dataSource, options } = setup();
    const route = new AuditTrailRoute(services, options, dataSource, 'books');
    const context = createMockContext({
      state: { user: { email: 'john.doe@domain.com' } },
      customProperties: { query: { timezone: 'Europe/Paris' }, params: { id: '2' } },
    });

    await route.handleHistory(context);

    expect(services.authorization.assertCanRead).toHaveBeenCalledWith(context, 'books');
  });

  describe('conditional mounting', () => {
    const buildDataSource = () =>
      factories.dataSource.buildWithCollections([
        factories.collection.build({
          name: 'books',
          schema: factories.collectionSchema.build({
            fields: { id: factories.columnSchema.numericPrimaryKey().build() },
          }),
        }),
      ]);

    test('mounts one audit-trail route per collection when a store is configured', () => {
      const services = factories.forestAdminHttpDriverServices.build();
      const dataSource = buildDataSource();
      const store = { listByRecord: jest.fn() };
      const options = factories.forestAdminHttpDriverOptions.build({ auditTrail: { store } });

      const routes = makeRoutes(dataSource, options, services);

      expect(routes.filter(route => route instanceof AuditTrailRoute)).toHaveLength(1);
    });

    test('mounts no audit-trail route when no store is configured', () => {
      const services = factories.forestAdminHttpDriverServices.build();
      const dataSource = buildDataSource();
      const options = factories.forestAdminHttpDriverOptions.build();

      const routes = makeRoutes(dataSource, options, services);

      expect(routes.filter(route => route instanceof AuditTrailRoute)).toHaveLength(0);
    });
  });
});
