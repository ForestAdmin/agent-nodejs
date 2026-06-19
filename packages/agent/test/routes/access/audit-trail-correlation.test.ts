import { createMockContext } from '@shopify/jest-koa-mocks';

import makeRoutes from '../../../src/routes';
import AuditTrailCorrelationRoute from '../../../src/routes/access/audit-trail-correlation';
import * as factories from '../../__factories__';

describe('AuditTrailCorrelationRoute', () => {
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
    const store = {
      listByRecord: jest.fn(),
      countByRecord: jest.fn(),
      listByCorrelation: jest.fn().mockResolvedValue(history),
      listByCorrelations: jest.fn().mockResolvedValue(history),
    };
    const options = factories.forestAdminHttpDriverOptions.build({
      auditTrail: { connectionString: 'sqlite::memory:', store } as never,
    });

    return { services, dataSource, options, store };
  };

  const contextWith = (query: Record<string, unknown>, correlationKey = 'req-1') =>
    createMockContext({
      state: { user: { email: 'john.doe@domain.com' } },
      customProperties: { query, params: { correlationKey } },
    });

  test('registers the "/_audit-trail/correlation/:correlationKey" route', () => {
    const { services, dataSource, options } = setup();
    const router = factories.router.mockAllMethods().build();

    new AuditTrailCorrelationRoute(services, options, dataSource).setupRoutes(router);

    expect(router.get).toHaveBeenCalledWith(
      '/_audit-trail/correlation/:correlationKey',
      expect.any(Function),
    );
  });

  test('registers the batch "/_audit-trail/correlations" route on GET and POST', () => {
    const { services, dataSource, options } = setup();
    const router = factories.router.mockAllMethods().build();

    new AuditTrailCorrelationRoute(services, options, dataSource).setupRoutes(router);

    expect(router.get).toHaveBeenCalledWith('/_audit-trail/correlations', expect.any(Function));
    expect(router.post).toHaveBeenCalledWith('/_audit-trail/correlations', expect.any(Function));
  });

  test('GET /correlations returns a flat list for the comma-separated keys', async () => {
    const history = [
      { operation: 'update', correlationKey: 'a' },
      { operation: 'create', correlationKey: 'b' },
    ];
    const { services, dataSource, options, store } = setup(history);
    const route = new AuditTrailCorrelationRoute(services, options, dataSource);
    const context = contextWith({
      timezone: 'Europe/Paris',
      collection: 'books',
      recordId: '2',
      correlationKeys: 'a, b',
    });

    await route.handleBatch(context);

    expect(store.listByCorrelations).toHaveBeenCalledWith({
      collection: 'books',
      recordId: '2',
      correlationKeys: ['a', 'b'],
    });
    expect(context.response.body).toEqual({ data: history });
  });

  test('POST /correlations reads the keys (and scope) from the body', async () => {
    const history = [{ operation: 'update', correlationKey: 'a' }];
    const { services, dataSource, options, store } = setup(history);
    const route = new AuditTrailCorrelationRoute(services, options, dataSource);
    const context = createMockContext({
      state: { user: { email: 'john.doe@domain.com' } },
      customProperties: { query: { timezone: 'Europe/Paris' } },
      requestBody: { collection: 'books', recordId: '2', correlationKeys: ['a', 'b'] },
    });

    await route.handleBatch(context);

    expect(services.authorization.assertCanRead).toHaveBeenCalledWith(context, 'books');
    expect(store.listByCorrelations).toHaveBeenCalledWith({
      collection: 'books',
      recordId: '2',
      correlationKeys: ['a', 'b'],
    });
    expect(context.response.body).toEqual({ data: history });
  });

  test('/correlations returns an empty array without querying when no key is given', async () => {
    const { services, dataSource, options, store } = setup();
    const route = new AuditTrailCorrelationRoute(services, options, dataSource);
    const context = contextWith({ timezone: 'Europe/Paris', collection: 'books', recordId: '2' });

    await route.handleBatch(context);

    expect(store.listByCorrelations).not.toHaveBeenCalled();
    expect(context.response.body).toEqual({ data: [] });
  });

  test('/correlations rejects when the collection is missing', async () => {
    const { services, dataSource, options, store } = setup();
    const route = new AuditTrailCorrelationRoute(services, options, dataSource);
    const context = contextWith({ timezone: 'Europe/Paris', recordId: '2', correlationKeys: 'a' });

    await expect(route.handleBatch(context)).rejects.toThrow('Missing collection');
    expect(store.listByCorrelations).not.toHaveBeenCalled();
  });

  test('returns the records scoped to the correlationKey, collection and recordId', async () => {
    const history = [{ operation: 'update', correlationKey: 'req-1' }];
    const { services, dataSource, options, store } = setup(history);
    const route = new AuditTrailCorrelationRoute(services, options, dataSource);
    const context = contextWith({ timezone: 'Europe/Paris', collection: 'books', recordId: '2' });

    await route.handleHistory(context);

    expect(store.listByCorrelation).toHaveBeenCalledWith({
      collection: 'books',
      recordId: '2',
      correlationKey: 'req-1',
    });
    expect(context.response.body).toEqual({ data: history });
  });

  test('asserts the user can read the collection from the query param', async () => {
    const { services, dataSource, options } = setup();
    const route = new AuditTrailCorrelationRoute(services, options, dataSource);
    const context = contextWith({ timezone: 'Europe/Paris', collection: 'books', recordId: '2' });

    await route.handleHistory(context);

    expect(services.authorization.assertCanRead).toHaveBeenCalledWith(context, 'books');
  });

  test('returns an empty array when nothing matches', async () => {
    const { services, dataSource, options } = setup([]);
    const route = new AuditTrailCorrelationRoute(services, options, dataSource);
    const context = contextWith(
      { timezone: 'Europe/Paris', collection: 'books', recordId: '99' },
      'req-x',
    );

    await route.handleHistory(context);

    expect(context.response.body).toEqual({ data: [] });
  });

  test('rejects when the collection query param is missing', async () => {
    const { services, dataSource, options, store } = setup();
    const route = new AuditTrailCorrelationRoute(services, options, dataSource);
    const context = contextWith({ timezone: 'Europe/Paris', recordId: '2' });

    await expect(route.handleHistory(context)).rejects.toThrow('Missing collection');
    expect(store.listByCorrelation).not.toHaveBeenCalled();
  });

  test('rejects when the recordId query param is missing', async () => {
    const { services, dataSource, options, store } = setup();
    const route = new AuditTrailCorrelationRoute(services, options, dataSource);
    const context = contextWith({ timezone: 'Europe/Paris', collection: 'books' });

    await expect(route.handleHistory(context)).rejects.toThrow('Missing recordId');
    expect(store.listByCorrelation).not.toHaveBeenCalled();
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

    test('mounts one correlation route when a store is configured', () => {
      const services = factories.forestAdminHttpDriverServices.build();
      const dataSource = buildDataSource();
      const store = {
        listByRecord: jest.fn(),
        countByRecord: jest.fn(),
        listByCorrelation: jest.fn(),
        listByCorrelations: jest.fn(),
      };
      const options = factories.forestAdminHttpDriverOptions.build({
        auditTrail: { connectionString: 'sqlite::memory:', store } as never,
      });

      const routes = makeRoutes(dataSource, options, services);

      expect(routes.filter(route => route instanceof AuditTrailCorrelationRoute)).toHaveLength(1);
    });

    test('mounts no correlation route when no store is configured', () => {
      const services = factories.forestAdminHttpDriverServices.build();
      const dataSource = buildDataSource();
      const options = factories.forestAdminHttpDriverOptions.build();

      const routes = makeRoutes(dataSource, options, services);

      expect(routes.filter(route => route instanceof AuditTrailCorrelationRoute)).toHaveLength(0);
    });
  });
});
