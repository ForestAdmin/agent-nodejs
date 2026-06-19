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
    const store = {
      listByRecord: jest.fn().mockResolvedValue(history),
      countByRecord: jest.fn().mockResolvedValue(history.length),
    };
    const options = factories.forestAdminHttpDriverOptions.build({
      auditTrail: { connectionString: 'sqlite::memory:', store } as never,
    });

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
      limit: 20,
      order: 'desc',
    });
    expect(context.response.body).toEqual({ data: history, meta: { count: 1 } });
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
      order: 'desc',
    });
  });

  test('defaults to page 1 with a size of 20 when no pagination is given', async () => {
    const { services, dataSource, options, store } = setup();
    const route = new AuditTrailRoute(services, options, dataSource, 'books');
    const context = createMockContext({
      state: { user: { email: 'john.doe@domain.com' } },
      customProperties: { query: { timezone: 'Europe/Paris' }, params: { id: '2' } },
    });

    await route.handleHistory(context);

    expect(store.listByRecord).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, limit: 20 }),
    );
  });

  test('reads the last page', async () => {
    const { services, dataSource, options, store } = setup();
    const route = new AuditTrailRoute(services, options, dataSource, 'books');
    const context = createMockContext({
      state: { user: { email: 'john.doe@domain.com' } },
      customProperties: {
        query: { timezone: 'Europe/Paris', 'page[size]': '50', 'page[number]': '3' },
        params: { id: '2' },
      },
    });

    await route.handleHistory(context);

    expect(store.listByRecord).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 100, limit: 50 }),
    );
  });

  test('caps page[size] at 100', async () => {
    const { services, dataSource, options, store } = setup();
    const route = new AuditTrailRoute(services, options, dataSource, 'books');
    const context = createMockContext({
      state: { user: { email: 'john.doe@domain.com' } },
      customProperties: {
        query: { timezone: 'Europe/Paris', 'page[size]': '500', 'page[number]': '1' },
        params: { id: '2' },
      },
    });

    await route.handleHistory(context);

    expect(store.listByRecord).toHaveBeenCalledWith(expect.objectContaining({ limit: 100 }));
  });

  test('returns the filtered total in meta.count, independent of the page', async () => {
    const { services, dataSource, options, store } = setup();
    store.countByRecord.mockResolvedValue(137);
    const route = new AuditTrailRoute(services, options, dataSource, 'books');
    const context = createMockContext({
      state: { user: { email: 'john.doe@domain.com' } },
      customProperties: {
        query: { timezone: 'UTC', userIds: '7', 'page[size]': '20', 'page[number]': '2' },
        params: { id: '2' },
      },
    });

    await route.handleHistory(context);

    expect(store.countByRecord).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'books', recordId: '2', userIds: [7] }),
    );
    expect(store.countByRecord).toHaveBeenCalledWith(
      expect.not.objectContaining({ skip: expect.anything(), limit: expect.anything() }),
    );
    expect(context.response.body).toMatchObject({ meta: { count: 137 } });
  });

  test('forwards a comma-separated userIds filter as a list of integers', async () => {
    const { services, dataSource, options, store } = setup();
    const route = new AuditTrailRoute(services, options, dataSource, 'books');
    const context = createMockContext({
      state: { user: { email: 'john.doe@domain.com' } },
      customProperties: {
        query: { timezone: 'Europe/Paris', userIds: '12,45' },
        params: { id: '2' },
      },
    });

    await route.handleHistory(context);

    expect(store.listByRecord).toHaveBeenCalledWith(expect.objectContaining({ userIds: [12, 45] }));
  });

  test('drops non-numeric userIds tokens', async () => {
    const { services, dataSource, options, store } = setup();
    const route = new AuditTrailRoute(services, options, dataSource, 'books');
    const context = createMockContext({
      state: { user: { email: 'john.doe@domain.com' } },
      customProperties: {
        query: { timezone: 'Europe/Paris', userIds: '12,abc,45' },
        params: { id: '2' },
      },
    });

    await route.handleHistory(context);

    expect(store.listByRecord).toHaveBeenCalledWith(expect.objectContaining({ userIds: [12, 45] }));
  });

  test('omits the userIds filter when every token is non-numeric', async () => {
    const { services, dataSource, options, store } = setup();
    const route = new AuditTrailRoute(services, options, dataSource, 'books');
    const context = createMockContext({
      state: { user: { email: 'john.doe@domain.com' } },
      customProperties: {
        query: { timezone: 'Europe/Paris', userIds: 'abc,def' },
        params: { id: '2' },
      },
    });

    await route.handleHistory(context);

    expect(store.listByRecord).toHaveBeenCalledWith(
      expect.not.objectContaining({ userIds: expect.anything() }),
    );
  });

  test('converts startDate/endDate to inclusive UTC instants in the request timezone', async () => {
    const { services, dataSource, options, store } = setup();
    const route = new AuditTrailRoute(services, options, dataSource, 'books');
    const context = createMockContext({
      state: { user: { email: 'john.doe@domain.com' } },
      customProperties: {
        query: { timezone: 'Europe/Paris', startDate: '2026-06-17', endDate: '2026-06-17' },
        params: { id: '2' },
      },
    });

    await route.handleHistory(context);

    expect(store.listByRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        startTimestamp: '2026-06-16T22:00:00.000Z',
        endTimestamp: '2026-06-17T21:59:59.999Z',
      }),
    );
  });

  test('combines userIds and date range filters', async () => {
    const { services, dataSource, options, store } = setup();
    const route = new AuditTrailRoute(services, options, dataSource, 'books');
    const context = createMockContext({
      state: { user: { email: 'john.doe@domain.com' } },
      customProperties: {
        query: {
          timezone: 'UTC',
          userIds: '7',
          startDate: '2026-01-01',
          endDate: '2026-01-31',
        },
        params: { id: '2' },
      },
    });

    await route.handleHistory(context);

    expect(store.listByRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        userIds: [7],
        startTimestamp: '2026-01-01T00:00:00.000Z',
        endTimestamp: '2026-01-31T23:59:59.999Z',
      }),
    );
  });

  test('does not pass any filter when no filter param is present', async () => {
    const { services, dataSource, options, store } = setup();
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
      limit: 20,
      order: 'desc',
    });
  });

  test('defaults to newest-first (desc) when no sort is given', async () => {
    const { services, dataSource, options, store } = setup();
    const route = new AuditTrailRoute(services, options, dataSource, 'books');
    const context = createMockContext({
      state: { user: { email: 'john.doe@domain.com' } },
      customProperties: { query: { timezone: 'Europe/Paris' }, params: { id: '2' } },
    });

    await route.handleHistory(context);

    expect(store.listByRecord).toHaveBeenCalledWith(expect.objectContaining({ order: 'desc' }));
  });

  test('maps sort=-timestamp to a descending order', async () => {
    const { services, dataSource, options, store } = setup();
    const route = new AuditTrailRoute(services, options, dataSource, 'books');
    const context = createMockContext({
      state: { user: { email: 'john.doe@domain.com' } },
      customProperties: {
        query: { timezone: 'Europe/Paris', sort: '-timestamp' },
        params: { id: '2' },
      },
    });

    await route.handleHistory(context);

    expect(store.listByRecord).toHaveBeenCalledWith(expect.objectContaining({ order: 'desc' }));
  });

  test('maps sort=timestamp to an ascending order', async () => {
    const { services, dataSource, options, store } = setup();
    const route = new AuditTrailRoute(services, options, dataSource, 'books');
    const context = createMockContext({
      state: { user: { email: 'john.doe@domain.com' } },
      customProperties: {
        query: { timezone: 'Europe/Paris', sort: 'timestamp' },
        params: { id: '2' },
      },
    });

    await route.handleHistory(context);

    expect(store.listByRecord).toHaveBeenCalledWith(expect.objectContaining({ order: 'asc' }));
  });

  test('rejects a malformed date with a validation error', async () => {
    const { services, dataSource, options, store } = setup();
    const route = new AuditTrailRoute(services, options, dataSource, 'books');
    const context = createMockContext({
      state: { user: { email: 'john.doe@domain.com' } },
      customProperties: {
        query: { timezone: 'Europe/Paris', startDate: '17-06-2026' },
        params: { id: '2' },
      },
    });

    await expect(route.handleHistory(context)).rejects.toThrow(
      'Invalid date: "17-06-2026" (expected YYYY-MM-DD or YYYY-MM-DDTHH:mm)',
    );
    expect(store.listByRecord).not.toHaveBeenCalled();
  });

  test('accepts a wall-clock datetime with a T separator and converts it to UTC', async () => {
    const { services, dataSource, options, store } = setup();
    const route = new AuditTrailRoute(services, options, dataSource, 'books');
    const context = createMockContext({
      state: { user: { email: 'john.doe@domain.com' } },
      customProperties: {
        query: {
          timezone: 'Europe/Paris',
          startDate: '2026-06-18T11:48',
          endDate: '2026-06-18T15:30',
        },
        params: { id: '2' },
      },
    });

    await route.handleHistory(context);

    expect(store.listByRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        startTimestamp: '2026-06-18T09:48:00.000Z',
        endTimestamp: '2026-06-18T13:30:59.999Z',
      }),
    );
  });

  test('accepts a space separator between date and time', async () => {
    const { services, dataSource, options, store } = setup();
    const route = new AuditTrailRoute(services, options, dataSource, 'books');
    const context = createMockContext({
      state: { user: { email: 'john.doe@domain.com' } },
      customProperties: {
        query: { timezone: 'UTC', startDate: '2026-06-18 11:48' },
        params: { id: '2' },
      },
    });

    await route.handleHistory(context);

    expect(store.listByRecord).toHaveBeenCalledWith(
      expect.objectContaining({ startTimestamp: '2026-06-18T11:48:00.000Z' }),
    );
  });

  test('uses provided seconds as-is for both boundaries', async () => {
    const { services, dataSource, options, store } = setup();
    const route = new AuditTrailRoute(services, options, dataSource, 'books');
    const context = createMockContext({
      state: { user: { email: 'john.doe@domain.com' } },
      customProperties: {
        query: {
          timezone: 'UTC',
          startDate: '2026-06-18T11:48:30',
          endDate: '2026-06-18T15:30:30',
        },
        params: { id: '2' },
      },
    });

    await route.handleHistory(context);

    expect(store.listByRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        startTimestamp: '2026-06-18T11:48:30.000Z',
        endTimestamp: '2026-06-18T15:30:30.000Z',
      }),
    );
  });

  test('converts wall-clock datetimes through a non-UTC timezone', async () => {
    const { services, dataSource, options, store } = setup();
    const route = new AuditTrailRoute(services, options, dataSource, 'books');
    const context = createMockContext({
      state: { user: { email: 'john.doe@domain.com' } },
      customProperties: {
        query: {
          timezone: 'America/New_York',
          startDate: '2026-06-18T00:00',
          endDate: '2026-06-18T23:00',
        },
        params: { id: '2' },
      },
    });

    await route.handleHistory(context);

    expect(store.listByRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        startTimestamp: '2026-06-18T04:00:00.000Z',
        endTimestamp: '2026-06-19T03:00:59.999Z',
      }),
    );
  });

  test('rejects a datetime that matches no accepted format', async () => {
    const { services, dataSource, options, store } = setup();
    const route = new AuditTrailRoute(services, options, dataSource, 'books');
    const context = createMockContext({
      state: { user: { email: 'john.doe@domain.com' } },
      customProperties: {
        query: { timezone: 'Europe/Paris', startDate: '2026-06-18T11' },
        params: { id: '2' },
      },
    });

    await expect(route.handleHistory(context)).rejects.toThrow(
      'Invalid date: "2026-06-18T11" (expected YYYY-MM-DD or YYYY-MM-DDTHH:mm)',
    );
    expect(store.listByRecord).not.toHaveBeenCalled();
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
      const store = { listByRecord: jest.fn(), countByRecord: jest.fn() };
      const options = factories.forestAdminHttpDriverOptions.build({
        auditTrail: { connectionString: 'sqlite::memory:', store } as never,
      });

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
