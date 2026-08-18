import { ConditionTreeLeaf } from '@forestadmin/datasource-toolkit';
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
          fields: {
            id: factories.columnSchema.numericPrimaryKey().build(),
            ownerId: factories.columnSchema.build({
              columnType: 'Number',
              filterOperators: new Set(['Equal']),
            }),
          },
        }),
      }),
    ]);
    const store = {
      listByRecord: jest.fn().mockResolvedValue(history),
      countByRecord: jest.fn().mockResolvedValue(history.length),
      listDistinctUsers: jest.fn().mockResolvedValue([]),
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

  test('registers the "/_audit-trail/books/:id/state" route', () => {
    const { services, dataSource, options } = setup();
    const router = factories.router.mockAllMethods().build();

    new AuditTrailRoute(services, options, dataSource, 'books').setupRoutes(router);

    expect(router.get).toHaveBeenCalledWith('/_audit-trail/books/:id/state', expect.any(Function));
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
    expect(context.response.body).toEqual({
      data: history,
      meta: { count: 1, availableUsers: [] },
    });
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

  describe('meta.availableUsers', () => {
    test('fetches distinct users, scoped to the active filters, on the first fetch', async () => {
      const { services, dataSource, options, store } = setup();
      store.listDistinctUsers.mockResolvedValue([
        { id: 1, firstName: 'Jane', lastName: 'Doe', email: 'jane@forest.dev' },
      ]);
      const route = new AuditTrailRoute(services, options, dataSource, 'books');
      const context = createMockContext({
        state: { user: { email: 'john.doe@domain.com' } },
        customProperties: {
          query: { timezone: 'Europe/Paris', userIds: '1' },
          params: { id: '2' },
        },
      });

      await route.handleHistory(context);

      expect(store.listDistinctUsers).toHaveBeenCalledWith(
        expect.objectContaining({ collection: 'books', recordId: '2', userIds: [1] }),
      );
      expect(context.response.body).toMatchObject({
        meta: {
          availableUsers: [{ id: 1, firstName: 'Jane', lastName: 'Doe', email: 'jane@forest.dev' }],
        },
      });
    });

    test('omits availableUsers, without querying for it, once page[number] is explicit', async () => {
      const { services, dataSource, options, store } = setup();
      const route = new AuditTrailRoute(services, options, dataSource, 'books');
      const context = createMockContext({
        state: { user: { email: 'john.doe@domain.com' } },
        customProperties: {
          query: { timezone: 'Europe/Paris', 'page[number]': '2' },
          params: { id: '2' },
        },
      });

      await route.handleHistory(context);

      expect(store.listDistinctUsers).not.toHaveBeenCalled();
      expect(context.response.body).not.toHaveProperty('meta.availableUsers');
    });

    test('omits availableUsers for an explicit page[number]=1 too, not just later pages', async () => {
      // Only a truly omitted page[number] counts as "first fetch" — an explicit "1" is
      // indistinguishable from any other explicit page once parsed, so it is treated the same.
      const { services, dataSource, options, store } = setup();
      const route = new AuditTrailRoute(services, options, dataSource, 'books');
      const context = createMockContext({
        state: { user: { email: 'john.doe@domain.com' } },
        customProperties: {
          query: { timezone: 'Europe/Paris', 'page[number]': '1' },
          params: { id: '2' },
        },
      });

      await route.handleHistory(context);

      expect(store.listDistinctUsers).not.toHaveBeenCalled();
      expect(context.response.body).not.toHaveProperty('meta.availableUsers');
    });
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

  test('forwards a comma-separated fields filter to the store', async () => {
    const { services, dataSource, options, store } = setup();
    const route = new AuditTrailRoute(services, options, dataSource, 'books');
    const context = createMockContext({
      state: { user: { email: 'john.doe@domain.com' } },
      customProperties: {
        query: { timezone: 'Europe/Paris', fields: 'title,author' },
        params: { id: '2' },
      },
    });

    await route.handleHistory(context);

    expect(store.listByRecord).toHaveBeenCalledWith(
      expect.objectContaining({ fields: ['title', 'author'] }),
    );
    expect(store.countByRecord).toHaveBeenCalledWith(
      expect.objectContaining({ fields: ['title', 'author'] }),
    );
  });

  test('trims whitespace around field tokens and drops empty ones', async () => {
    const { services, dataSource, options, store } = setup();
    const route = new AuditTrailRoute(services, options, dataSource, 'books');
    const context = createMockContext({
      state: { user: { email: 'john.doe@domain.com' } },
      customProperties: {
        query: { timezone: 'Europe/Paris', fields: ' title , , author ' },
        params: { id: '2' },
      },
    });

    await route.handleHistory(context);

    expect(store.listByRecord).toHaveBeenCalledWith(
      expect.objectContaining({ fields: ['title', 'author'] }),
    );
  });

  test('omits the fields filter when the parameter is empty', async () => {
    const { services, dataSource, options, store } = setup();
    const route = new AuditTrailRoute(services, options, dataSource, 'books');
    const context = createMockContext({
      state: { user: { email: 'john.doe@domain.com' } },
      customProperties: {
        query: { timezone: 'Europe/Paris', fields: '' },
        params: { id: '2' },
      },
    });

    await route.handleHistory(context);

    expect(store.listByRecord).toHaveBeenCalledWith(
      expect.not.objectContaining({ fields: expect.anything() }),
    );
  });

  test('omits the fields filter when every token is whitespace', async () => {
    const { services, dataSource, options, store } = setup();
    const route = new AuditTrailRoute(services, options, dataSource, 'books');
    const context = createMockContext({
      state: { user: { email: 'john.doe@domain.com' } },
      customProperties: {
        query: { timezone: 'Europe/Paris', fields: ' , , ' },
        params: { id: '2' },
      },
    });

    await route.handleHistory(context);

    expect(store.listByRecord).toHaveBeenCalledWith(
      expect.not.objectContaining({ fields: expect.anything() }),
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
      'Invalid date: "17-06-2026" (expected YYYY-MM-DD, YYYY-MM-DDTHH:mm, or an ISO 8601 instant)',
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
      'Invalid date: "2026-06-18T11" (expected YYYY-MM-DD, YYYY-MM-DDTHH:mm, or an ISO 8601 instant)',
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

  describe('record-level scope', () => {
    test('does not check record existence when no scope is configured', async () => {
      const { services, dataSource, options, store } = setup();
      const list = jest.spyOn(dataSource.getCollection('books'), 'list');
      const route = new AuditTrailRoute(services, options, dataSource, 'books');
      const context = createMockContext({
        state: { user: { email: 'john.doe@domain.com' } },
        customProperties: { query: { timezone: 'Europe/Paris' }, params: { id: '2' } },
      });

      await route.handleHistory(context);

      expect(list).not.toHaveBeenCalled();
      expect(store.listByRecord).toHaveBeenCalled();
    });

    test('rejects an id that still exists outside a restrictive scope, without querying the store', async () => {
      const { services, dataSource, options, store } = setup();
      (services.authorization.getScope as jest.Mock).mockResolvedValue({
        field: 'ownerId',
        operator: 'Equal',
        value: 1,
      });
      jest
        .spyOn(dataSource.getCollection('books'), 'list')
        .mockResolvedValueOnce([]) // scoped check: not in scope
        .mockResolvedValueOnce([{ id: 2 }]); // bare check: still exists
      const route = new AuditTrailRoute(services, options, dataSource, 'books');
      const context = createMockContext({
        state: { user: { email: 'john.doe@domain.com' } },
        customProperties: { query: { timezone: 'Europe/Paris' }, params: { id: '2' } },
      });

      await route.handleHistory(context);

      expect(context.throw).toHaveBeenCalledWith(404, 'Record does not exists');
      expect(store.listByRecord).not.toHaveBeenCalled();
    });

    test("allows a deleted id through to the store, but withholds an out-of-scope delete row's previousValues", async () => {
      const history = [
        { operation: 'delete', recordId: '2', previousValues: { ownerId: 2, title: 'Secret' } },
      ];
      const { services, dataSource, options, store } = setup(history);
      (services.authorization.getScope as jest.Mock).mockResolvedValue(
        new ConditionTreeLeaf('ownerId', 'Equal', 1),
      );
      jest
        .spyOn(dataSource.getCollection('books'), 'list')
        .mockResolvedValueOnce([]) // scoped check: not found
        .mockResolvedValueOnce([]); // bare check: genuinely gone, not just out of scope
      const route = new AuditTrailRoute(services, options, dataSource, 'books');
      const context = createMockContext({
        state: { user: { email: 'john.doe@domain.com' } },
        customProperties: { query: { timezone: 'Europe/Paris' }, params: { id: '2' } },
      });

      await route.handleHistory(context);

      expect(context.throw).not.toHaveBeenCalled();
      expect(store.listByRecord).toHaveBeenCalled();
      expect(context.response.body).toEqual({
        data: [{ operation: 'delete', recordId: '2', previousValues: {} }],
        meta: { count: 1, availableUsers: [] },
      });
    });

    test("keeps a genuinely-deleted delete row's previousValues when they match the caller's scope", async () => {
      const history = [
        { operation: 'delete', recordId: '2', previousValues: { ownerId: 1, title: 'Visible' } },
      ];
      const { services, dataSource, options, store } = setup(history);
      (services.authorization.getScope as jest.Mock).mockResolvedValue(
        new ConditionTreeLeaf('ownerId', 'Equal', 1),
      );
      jest
        .spyOn(dataSource.getCollection('books'), 'list')
        .mockResolvedValueOnce([]) // scoped check: not found
        .mockResolvedValueOnce([]); // bare check: genuinely gone, not just out of scope
      const route = new AuditTrailRoute(services, options, dataSource, 'books');
      const context = createMockContext({
        state: { user: { email: 'john.doe@domain.com' } },
        customProperties: { query: { timezone: 'Europe/Paris' }, params: { id: '2' } },
      });

      await route.handleHistory(context);

      expect(context.throw).not.toHaveBeenCalled();
      expect(store.listByRecord).toHaveBeenCalled();
      expect(context.response.body).toEqual({
        data: history,
        meta: { count: 1, availableUsers: [] },
      });
    });

    test('unconditionally withholds an update row for a genuinely gone, scoped record — its values are a partial diff, not a full record', async () => {
      // A scope condition can reference a column this particular update didn't even touch, so the
      // match can't be evaluated reliably against a partial diff — withhold regardless, rather
      // than risk a false negative that would leak column values the caller was never allowed to
      // see (this is exactly the gap the create/delete-only version of this fix left open).
      const history = [
        {
          operation: 'update',
          recordId: '2',
          previousValues: { title: 'Old' },
          newValues: { title: 'New' },
        },
      ];
      const { services, dataSource, options, store } = setup(history);
      (services.authorization.getScope as jest.Mock).mockResolvedValue(
        new ConditionTreeLeaf('ownerId', 'Equal', 1),
      );
      jest
        .spyOn(dataSource.getCollection('books'), 'list')
        .mockResolvedValueOnce([]) // scoped check: not found
        .mockResolvedValueOnce([]); // bare check: genuinely gone, not just out of scope
      const route = new AuditTrailRoute(services, options, dataSource, 'books');
      const context = createMockContext({
        state: { user: { email: 'john.doe@domain.com' } },
        customProperties: { query: { timezone: 'Europe/Paris' }, params: { id: '2' } },
      });

      await route.handleHistory(context);

      expect(store.listByRecord).toHaveBeenCalled();
      expect(context.response.body).toEqual({
        data: [{ operation: 'update', recordId: '2', previousValues: {}, newValues: {} }],
        meta: { count: 1, availableUsers: [] },
      });
    });

    test("withholds an out-of-scope create row's newValues for a genuinely gone, scoped record", async () => {
      const history = [
        { operation: 'create', recordId: '2', newValues: { ownerId: 2, title: 'Secret' } },
      ];
      const { services, dataSource, options } = setup(history);
      (services.authorization.getScope as jest.Mock).mockResolvedValue(
        new ConditionTreeLeaf('ownerId', 'Equal', 1),
      );
      jest
        .spyOn(dataSource.getCollection('books'), 'list')
        .mockResolvedValueOnce([]) // scoped check: not found
        .mockResolvedValueOnce([]); // bare check: genuinely gone, not just out of scope
      const route = new AuditTrailRoute(services, options, dataSource, 'books');
      const context = createMockContext({
        state: { user: { email: 'john.doe@domain.com' } },
        customProperties: { query: { timezone: 'Europe/Paris' }, params: { id: '2' } },
      });

      await route.handleHistory(context);

      expect(context.response.body).toEqual({
        data: [{ operation: 'create', recordId: '2', newValues: {} }],
        meta: { count: 1, availableUsers: [] },
      });
    });

    test("keeps a genuinely-gone create row's newValues when they match the caller's scope", async () => {
      const history = [
        { operation: 'create', recordId: '2', newValues: { ownerId: 1, title: 'Visible' } },
      ];
      const { services, dataSource, options } = setup(history);
      (services.authorization.getScope as jest.Mock).mockResolvedValue(
        new ConditionTreeLeaf('ownerId', 'Equal', 1),
      );
      jest
        .spyOn(dataSource.getCollection('books'), 'list')
        .mockResolvedValueOnce([]) // scoped check: not found
        .mockResolvedValueOnce([]); // bare check: genuinely gone, not just out of scope
      const route = new AuditTrailRoute(services, options, dataSource, 'books');
      const context = createMockContext({
        state: { user: { email: 'john.doe@domain.com' } },
        customProperties: { query: { timezone: 'Europe/Paris' }, params: { id: '2' } },
      });

      await route.handleHistory(context);

      expect(context.response.body).toEqual({
        data: history,
        meta: { count: 1, availableUsers: [] },
      });
    });

    test('intersects the scope with the record id when checking visibility', async () => {
      const { services, dataSource, options } = setup();
      const scope = { field: 'ownerId', operator: 'Equal', value: 1 };
      (services.authorization.getScope as jest.Mock).mockResolvedValue(scope);
      const list = jest
        .spyOn(dataSource.getCollection('books'), 'list')
        .mockResolvedValue([{ id: 2 }]);
      const route = new AuditTrailRoute(services, options, dataSource, 'books');
      const context = createMockContext({
        state: { user: { email: 'john.doe@domain.com' } },
        customProperties: { query: { timezone: 'Europe/Paris' }, params: { id: '2' } },
      });

      await route.handleHistory(context);

      expect(list).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          conditionTree: expect.objectContaining({
            aggregator: 'And',
            conditions: expect.arrayContaining([expect.objectContaining(scope)]),
          }),
        }),
        expect.anything(),
      );
      expect(context.throw).not.toHaveBeenCalled();
    });

    test('allows an id inside a restrictive scope through to the store', async () => {
      const { services, dataSource, options, store } = setup();
      (services.authorization.getScope as jest.Mock).mockResolvedValue({
        field: 'ownerId',
        operator: 'Equal',
        value: 1,
      });
      jest.spyOn(dataSource.getCollection('books'), 'list').mockResolvedValue([{ id: 2 }]);
      const route = new AuditTrailRoute(services, options, dataSource, 'books');
      const context = createMockContext({
        state: { user: { email: 'john.doe@domain.com' } },
        customProperties: { query: { timezone: 'Europe/Paris' }, params: { id: '2' } },
      });

      await route.handleHistory(context);

      expect(context.throw).not.toHaveBeenCalled();
      expect(store.listByRecord).toHaveBeenCalled();
    });
  });

  describe('handleStateAt', () => {
    const setupBooks = (history: unknown[] = []) => {
      const services = factories.forestAdminHttpDriverServices.build();
      const dataSource = factories.dataSource.buildWithCollections([
        factories.collection.build({
          name: 'books',
          schema: factories.collectionSchema.build({
            fields: {
              id: factories.columnSchema.numericPrimaryKey().build(),
              status: factories.columnSchema.build({ columnType: 'String' }),
              name: factories.columnSchema.build({ columnType: 'String' }),
              displayName: factories.columnSchema.build({ columnType: 'String', isReadOnly: true }),
            },
          }),
        }),
      ]);
      const store = {
        listByRecord: jest.fn().mockResolvedValue(history),
        countByRecord: jest.fn(),
      };
      const options = factories.forestAdminHttpDriverOptions.build({
        auditTrail: { connectionString: 'sqlite::memory:', store } as never,
      });
      const route = new AuditTrailRoute(services, options, dataSource, 'books');

      return { services, dataSource, options, store, route };
    };

    test('queries the store with the parsed UTC timestamp, desc order, no pagination', async () => {
      const { dataSource, store, route } = setupBooks([]);
      jest
        .spyOn(dataSource.getCollection('books'), 'list')
        .mockResolvedValue([{ id: 2, status: 'closed', name: 'Acme' }]);
      const context = createMockContext({
        state: { user: { email: 'john.doe@domain.com' } },
        customProperties: {
          query: { timezone: 'Europe/Paris', at: '2026-06-18T12:00' },
          params: { id: '2' },
        },
      });

      await route.handleStateAt(context);

      expect(store.listByRecord).toHaveBeenCalledWith({
        collection: 'books',
        recordId: '2',
        startTimestamp: '2026-06-18T10:00:00.000Z',
        order: 'desc',
      });
    });

    test('rejects a missing "at" query parameter', async () => {
      const { dataSource, route } = setupBooks();
      jest.spyOn(dataSource.getCollection('books'), 'list').mockResolvedValue([]);
      const context = createMockContext({
        state: { user: { email: 'john.doe@domain.com' } },
        customProperties: { query: { timezone: 'Europe/Paris' }, params: { id: '2' } },
      });

      await expect(route.handleStateAt(context)).rejects.toThrow('Missing "at" query parameter');
    });

    test('rejects a malformed "at" value', async () => {
      const { dataSource, route } = setupBooks();
      jest.spyOn(dataSource.getCollection('books'), 'list').mockResolvedValue([]);
      const context = createMockContext({
        state: { user: { email: 'john.doe@domain.com' } },
        customProperties: {
          query: { timezone: 'Europe/Paris', at: '17-06-2026' },
          params: { id: '2' },
        },
      });

      await expect(route.handleStateAt(context)).rejects.toThrow(
        'Invalid date: "17-06-2026" (expected YYYY-MM-DD, YYYY-MM-DDTHH:mm, or an ISO 8601 instant)',
      );
    });

    test('does not require a timezone query param when the timestamp is an ISO 8601 instant', async () => {
      const { dataSource, store, route } = setupBooks([]);
      jest
        .spyOn(dataSource.getCollection('books'), 'list')
        .mockResolvedValue([{ id: 2, status: 'closed', name: 'Acme' }]);
      const context = createMockContext({
        state: { user: { email: 'john.doe@domain.com' } },
        customProperties: {
          query: { at: '2026-06-18T14:26:06.545Z' },
          params: { id: '2' },
        },
      });

      await route.handleStateAt(context);

      expect(store.listByRecord).toHaveBeenCalledWith({
        collection: 'books',
        recordId: '2',
        startTimestamp: '2026-06-18T14:26:06.545Z',
        order: 'desc',
      });
    });

    test('accepts an ISO 8601 instant and ignores the request timezone for it', async () => {
      const { dataSource, store, route } = setupBooks([]);
      jest
        .spyOn(dataSource.getCollection('books'), 'list')
        .mockResolvedValue([{ id: 2, status: 'closed', name: 'Acme' }]);
      const context = createMockContext({
        state: { user: { email: 'john.doe@domain.com' } },
        customProperties: {
          query: { timezone: 'Europe/Paris', at: '2026-06-18T14:26:06.545Z' },
          params: { id: '2' },
        },
      });

      await route.handleStateAt(context);

      expect(store.listByRecord).toHaveBeenCalledWith({
        collection: 'books',
        recordId: '2',
        startTimestamp: '2026-06-18T14:26:06.545Z',
        order: 'desc',
      });
    });

    test('asserts the user can read the collection before returning state', async () => {
      const { services, dataSource, route } = setupBooks();
      jest
        .spyOn(dataSource.getCollection('books'), 'list')
        .mockResolvedValue([{ id: 2, status: 'closed', name: 'Acme' }]);
      const context = createMockContext({
        state: { user: { email: 'john.doe@domain.com' } },
        customProperties: {
          query: { timezone: 'Europe/Paris', at: '2026-06-18' },
          params: { id: '2' },
        },
      });

      await route.handleStateAt(context);

      expect(services.authorization.assertCanRead).toHaveBeenCalledWith(context, 'books');
    });

    test('reads the current record projected on audited columns only (PKs + writable)', async () => {
      const { dataSource, route } = setupBooks([]);
      const list = jest
        .spyOn(dataSource.getCollection('books'), 'list')
        .mockResolvedValue([{ id: 2, status: 'closed', name: 'Acme' }]);
      const context = createMockContext({
        state: { user: { email: 'john.doe@domain.com' } },
        customProperties: {
          query: { timezone: 'Europe/Paris', at: '2026-06-18' },
          params: { id: '2' },
        },
      });

      await route.handleStateAt(context);

      expect(list).toHaveBeenCalledWith(expect.anything(), expect.anything(), [
        'id',
        'status',
        'name',
      ]);
    });

    test('returns the current record unchanged when there are no audit entries at or after T', async () => {
      const { dataSource, route } = setupBooks([]);
      jest
        .spyOn(dataSource.getCollection('books'), 'list')
        .mockResolvedValue([{ id: 2, status: 'closed', name: 'Acme' }]);
      const context = createMockContext({
        state: { user: { email: 'john.doe@domain.com' } },
        customProperties: {
          query: { timezone: 'UTC', at: '2026-06-18T12:00' },
          params: { id: '2' },
        },
      });

      await route.handleStateAt(context);

      expect(context.response.body).toEqual({
        data: { id: 2, status: 'closed', name: 'Acme' },
      });
    });

    test('excludes action/action_failed rows from the revert walk, even when their keys collide with real columns', async () => {
      const history = [
        {
          operation: 'action',
          timestamp: '2026-06-18T13:00:00.000Z',
          // An action row's previousValues/newValues hold a submitted form and a result summary,
          // not column values — replaying this as a diff would wrongly revert `status` to
          // 'archived', with nothing else in the (empty otherwise) history to correct it back.
          previousValues: { status: 'archived' },
          newValues: { type: 'Success', message: 'ok' },
        },
      ];
      const { dataSource, route } = setupBooks(history);
      jest
        .spyOn(dataSource.getCollection('books'), 'list')
        .mockResolvedValue([{ id: 2, status: 'closed', name: 'Acme' }]);
      const context = createMockContext({
        state: { user: { email: 'john.doe@domain.com' } },
        customProperties: {
          query: { timezone: 'UTC', at: '2026-06-18T11:00:00.000Z' },
          params: { id: '2' },
        },
      });

      await route.handleStateAt(context);

      expect(context.response.body).toEqual({
        data: { id: 2, status: 'closed', name: 'Acme' },
      });
    });

    test('excludes a pending row from the revert walk — its write may not have landed', async () => {
      const history = [
        {
          operation: 'update',
          timestamp: '2026-06-18T13:00:00.000Z',
          status: 'pending',
          // A pending row's newValues is empty (nothing was confirmed yet); if it were replayed,
          // `status` would wrongly get reverted to 'archived' even though the write it represents
          // may never have landed at all.
          previousValues: { status: 'archived' },
          newValues: {},
        },
      ];
      const { dataSource, route } = setupBooks(history);
      jest
        .spyOn(dataSource.getCollection('books'), 'list')
        .mockResolvedValue([{ id: 2, status: 'closed', name: 'Acme' }]);
      const context = createMockContext({
        state: { user: { email: 'john.doe@domain.com' } },
        customProperties: {
          query: { timezone: 'UTC', at: '2026-06-18T11:00:00.000Z' },
          params: { id: '2' },
        },
      });

      await route.handleStateAt(context);

      expect(context.response.body).toEqual({
        data: { id: 2, status: 'closed', name: 'Acme' },
      });
    });

    test('preserves the entry timestamped exactly at the requested instant instead of reverting it', async () => {
      const history = [
        {
          operation: 'update',
          timestamp: '2026-06-18T12:00:00.000Z',
          previousValues: { status: 'open' },
          newValues: { status: 'closed' },
        },
      ];
      const { dataSource, route } = setupBooks(history);
      jest
        .spyOn(dataSource.getCollection('books'), 'list')
        .mockResolvedValue([{ id: 2, status: 'closed', name: 'Acme' }]);
      const context = createMockContext({
        state: { user: { email: 'john.doe@domain.com' } },
        customProperties: {
          query: { at: '2026-06-18T12:00:00.000Z' },
          params: { id: '2' },
        },
      });

      await route.handleStateAt(context);

      expect(context.response.body).toEqual({
        data: { id: 2, status: 'closed', name: 'Acme' },
      });
    });

    test('reverts updates by walking entries newest-first', async () => {
      const history = [
        {
          operation: 'update',
          previousValues: { status: 'closed' },
          newValues: { status: 'archived' },
        },
        {
          operation: 'update',
          previousValues: { status: 'open', name: 'Acme' },
          newValues: { status: 'closed', name: 'Acme Inc.' },
        },
      ];
      const { dataSource, route } = setupBooks(history);
      jest
        .spyOn(dataSource.getCollection('books'), 'list')
        .mockResolvedValue([{ id: 2, status: 'archived', name: 'Acme Inc.' }]);
      const context = createMockContext({
        state: { user: { email: 'john.doe@domain.com' } },
        customProperties: {
          query: { timezone: 'UTC', at: '2026-06-18' },
          params: { id: '2' },
        },
      });

      await route.handleStateAt(context);

      expect(context.response.body).toEqual({
        data: { id: 2, status: 'open', name: 'Acme' },
      });
    });

    test('returns 404 when the record does not exist now and the audit log is empty', async () => {
      const { dataSource, route } = setupBooks([]);
      jest.spyOn(dataSource.getCollection('books'), 'list').mockResolvedValue([]);
      const context = createMockContext({
        state: { user: { email: 'john.doe@domain.com' } },
        customProperties: {
          query: { timezone: 'UTC', at: '2026-06-18' },
          params: { id: '2' },
        },
      });

      await route.handleStateAt(context);

      expect(context.throw).toHaveBeenCalledWith(404, 'Record did not exist at this timestamp');
    });

    test('returns 404 when walking back hits a create (record did not exist yet at T)', async () => {
      const history = [
        { operation: 'create', previousValues: {}, newValues: { id: 2, status: 'open' } },
      ];
      const { dataSource, route } = setupBooks(history);
      jest
        .spyOn(dataSource.getCollection('books'), 'list')
        .mockResolvedValue([{ id: 2, status: 'open', name: 'Acme' }]);
      const context = createMockContext({
        state: { user: { email: 'john.doe@domain.com' } },
        customProperties: {
          query: { timezone: 'UTC', at: '2026-06-18' },
          params: { id: '2' },
        },
      });

      await route.handleStateAt(context);

      expect(context.throw).toHaveBeenCalledWith(404, 'Record did not exist at this timestamp');
    });

    test('returns the delete snapshot when the record is currently gone', async () => {
      const history = [
        {
          operation: 'delete',
          previousValues: { id: 2, status: 'closed', name: 'Acme' },
          newValues: {},
        },
      ];
      const { dataSource, route } = setupBooks(history);
      jest.spyOn(dataSource.getCollection('books'), 'list').mockResolvedValue([]);
      const context = createMockContext({
        state: { user: { email: 'john.doe@domain.com' } },
        customProperties: {
          query: { timezone: 'UTC', at: '2026-06-18' },
          params: { id: '2' },
        },
      });

      await route.handleStateAt(context);

      expect(context.response.body).toEqual({
        data: { id: 2, status: 'closed', name: 'Acme' },
      });
    });

    test('returns 404 when scope excludes an id that still exists', async () => {
      const history = [
        {
          operation: 'delete',
          previousValues: { id: 2, status: 'closed', name: 'Acme' },
          newValues: {},
        },
      ];
      const { services, dataSource, route } = setupBooks(history);
      (services.authorization.getScope as jest.Mock).mockResolvedValue({
        field: 'ownerId',
        operator: 'Equal',
        value: 1,
      });
      jest
        .spyOn(dataSource.getCollection('books'), 'list')
        .mockResolvedValueOnce([]) // scoped fetch: not found
        .mockResolvedValueOnce([{ id: 2 }]); // bare check: still exists
      const context = createMockContext({
        state: { user: { email: 'john.doe@domain.com' } },
        customProperties: {
          query: { timezone: 'UTC', at: '2026-06-18' },
          params: { id: '2' },
        },
      });

      await route.handleStateAt(context);

      expect(context.throw).toHaveBeenCalledWith(404, 'Record did not exist at this timestamp');
      expect(context.response.body).toBeUndefined();
    });

    test('exposes the delete snapshot, scope aside, once the record is genuinely gone', async () => {
      const history = [
        {
          operation: 'delete',
          previousValues: { id: 2, status: 'closed', name: 'Acme' },
          newValues: {},
        },
      ];
      const { services, dataSource, route } = setupBooks(history);
      (services.authorization.getScope as jest.Mock).mockResolvedValue({
        field: 'ownerId',
        operator: 'Equal',
        value: 1,
      });
      jest
        .spyOn(dataSource.getCollection('books'), 'list')
        .mockResolvedValueOnce([]) // scoped fetch: not found
        .mockResolvedValueOnce([]); // bare check: genuinely gone, not just out of scope
      const context = createMockContext({
        state: { user: { email: 'john.doe@domain.com' } },
        customProperties: {
          query: { timezone: 'UTC', at: '2026-06-18' },
          params: { id: '2' },
        },
      });

      await route.handleStateAt(context);

      expect(context.throw).not.toHaveBeenCalled();
      expect(context.response.body).toEqual({
        data: { id: 2, status: 'closed', name: 'Acme' },
      });
    });
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
