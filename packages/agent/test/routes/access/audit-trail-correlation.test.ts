import { ConditionTreeLeaf } from '@forestadmin/datasource-toolkit';
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

  describe('record-level scope', () => {
    test('does not check record existence when no scope is configured', async () => {
      const history = [{ operation: 'update', correlationKey: 'req-1' }];
      const { services, dataSource, options } = setup(history);
      const list = jest.spyOn(dataSource.getCollection('books'), 'list');
      const route = new AuditTrailCorrelationRoute(services, options, dataSource);
      const context = contextWith({ timezone: 'Europe/Paris', collection: 'books', recordId: '2' });

      await route.handleHistory(context);

      expect(list).not.toHaveBeenCalled();
      expect(context.response.body).toEqual({ data: history });
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
      const route = new AuditTrailCorrelationRoute(services, options, dataSource);
      const context = contextWith({ timezone: 'Europe/Paris', collection: 'books', recordId: '2' });

      await route.handleHistory(context);

      expect(context.throw).toHaveBeenCalledWith(404, 'Record does not exists');
      expect(store.listByCorrelation).not.toHaveBeenCalled();
    });

    // Same rule as the per-record history route: a gone record's captured values are tested
    // against the caller's scope here too, or they come back through a correlation lookup.
    describe('a genuinely gone record, single lookup', () => {
      const lookupUnder = async (scope: ConditionTreeLeaf) => {
        const history = [
          {
            operation: 'delete',
            recordId: '2',
            correlationKey: 'req-1',
            previousValues: { title: 'Secret' },
            newValues: {},
          },
        ];
        const { services, dataSource, options, store } = setup(history);
        (services.authorization.getScope as jest.Mock).mockResolvedValue(scope);
        jest
          .spyOn(dataSource.getCollection('books'), 'list')
          .mockResolvedValueOnce([]) // scoped check: not found
          .mockResolvedValueOnce([]); // bare check: genuinely gone
        const route = new AuditTrailCorrelationRoute(services, options, dataSource);
        const context = contextWith({
          timezone: 'Europe/Paris',
          collection: 'books',
          recordId: '2',
        });

        await route.handleHistory(context);

        return { context, store };
      };

      test('withholds the values the scope does not cover', async () => {
        const { context, store } = await lookupUnder(new ConditionTreeLeaf('id', 'Equal', 1));

        expect(context.throw).not.toHaveBeenCalled();
        expect(store.listByCorrelation).toHaveBeenCalled();
        expect((context.response.body as { data: unknown[] }).data).toEqual([
          {
            operation: 'delete',
            recordId: '2',
            correlationKey: 'req-1',
            previousValues: {},
            newValues: {},
          },
        ]);
      });

      test('keeps the values when the row is in scope', async () => {
        const { context } = await lookupUnder(new ConditionTreeLeaf('id', 'Equal', 2));

        expect((context.response.body as { data: unknown[] }).data).toEqual([
          {
            operation: 'delete',
            recordId: '2',
            correlationKey: 'req-1',
            previousValues: { title: 'Secret' },
            newValues: {},
          },
        ]);
      });
    });

    test('allows an id inside a restrictive scope through to the store', async () => {
      const history = [{ operation: 'update', correlationKey: 'req-1' }];
      const { services, dataSource, options, store } = setup(history);
      (services.authorization.getScope as jest.Mock).mockResolvedValue({
        field: 'ownerId',
        operator: 'Equal',
        value: 1,
      });
      jest.spyOn(dataSource.getCollection('books'), 'list').mockResolvedValue([{ id: 2 }]);
      const route = new AuditTrailCorrelationRoute(services, options, dataSource);
      const context = contextWith({ timezone: 'Europe/Paris', collection: 'books', recordId: '2' });

      await route.handleHistory(context);

      expect(context.throw).not.toHaveBeenCalled();
      expect(store.listByCorrelation).toHaveBeenCalled();
    });

    test('also applies the scope check on the batch route', async () => {
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
      const route = new AuditTrailCorrelationRoute(services, options, dataSource);
      const context = createMockContext({
        state: { user: { email: 'john.doe@domain.com' } },
        customProperties: { query: { timezone: 'Europe/Paris' } },
        requestBody: { collection: 'books', recordId: '2', correlationKeys: ['a'] },
      });

      await route.handleBatch(context);

      expect(context.throw).toHaveBeenCalledWith(404, 'Record does not exists');
      expect(store.listByCorrelations).not.toHaveBeenCalled();
    });

    // Same rule as the per-record history route: a gone record's captured values are tested
    // against the caller's scope here too, or they come back through a correlation lookup.
    describe('a genuinely gone record, batch route', () => {
      const lookupUnder = async (scope: ConditionTreeLeaf) => {
        const history = [
          {
            operation: 'delete',
            recordId: '2',
            correlationKey: 'req-1',
            previousValues: { title: 'Secret' },
            newValues: {},
          },
        ];
        const { services, dataSource, options, store } = setup(history);
        (services.authorization.getScope as jest.Mock).mockResolvedValue(scope);
        jest
          .spyOn(dataSource.getCollection('books'), 'list')
          .mockResolvedValueOnce([]) // scoped check: not found
          .mockResolvedValueOnce([]); // bare check: genuinely gone
        const route = new AuditTrailCorrelationRoute(services, options, dataSource);
        const context = contextWith({
          timezone: 'Europe/Paris',
          collection: 'books',
          recordId: '2',
          correlationKeys: 'req-1',
        });

        await route.handleBatch(context);

        return { context, store };
      };

      test('withholds the values the scope does not cover', async () => {
        const { context, store } = await lookupUnder(new ConditionTreeLeaf('id', 'Equal', 1));

        expect(context.throw).not.toHaveBeenCalled();
        expect(store.listByCorrelations).toHaveBeenCalled();
        expect((context.response.body as { data: unknown[] }).data).toEqual([
          {
            operation: 'delete',
            recordId: '2',
            correlationKey: 'req-1',
            previousValues: {},
            newValues: {},
          },
        ]);
      });

      test('keeps the values when the row is in scope', async () => {
        const { context } = await lookupUnder(new ConditionTreeLeaf('id', 'Equal', 2));

        expect((context.response.body as { data: unknown[] }).data).toEqual([
          {
            operation: 'delete',
            recordId: '2',
            correlationKey: 'req-1',
            previousValues: { title: 'Secret' },
            newValues: {},
          },
        ]);
      });
    });
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

  // The record can go away while the audit read is in flight; the decision is taken again on the
  // way out rather than reused from the check that authorized the request.
  // The batch returns every row under the given keys, so one response can carry sides that answer
  // the scope and sides that cannot. Each is decided on its own, not as a batch.
  test('decides each row of a batch on its own values', async () => {
    const history = [
      {
        operation: 'delete',
        recordId: '2',
        correlationKey: 'req-1',
        previousValues: { title: 'In scope, no id of its own' },
        newValues: {},
      },
      {
        // The key moved to 2, so this row is filed under 2 while its previous side was still 7.
        operation: 'update',
        recordId: '2',
        correlationKey: 'req-2',
        previousValues: { id: 7, title: 'Captured while out of scope' },
        newValues: { id: 2, title: 'In scope' },
      },
    ];
    const { services, dataSource, options } = setup(history);
    (services.authorization.getScope as jest.Mock).mockResolvedValue(
      new ConditionTreeLeaf('id', 'Equal', 2),
    );
    jest.spyOn(dataSource.getCollection('books'), 'list').mockResolvedValue([] as never);
    const route = new AuditTrailCorrelationRoute(services, options, dataSource);
    const context = contextWith({
      timezone: 'Europe/Paris',
      collection: 'books',
      recordId: '2',
      correlationKeys: 'req-1,req-2',
    });

    await route.handleBatch(context);

    expect((context.response.body as { data: unknown[] }).data).toEqual([
      // no id captured, so the packed id answers and it matches
      { ...history[0] },
      // the previous side carried id 7 and answers for itself: withheld, new side kept
      { ...history[1], previousValues: {} },
    ]);
  });

  describe('the record changes between the visibility check and the audit read', () => {
    const raceWith = async (...listAnswers: unknown[][]) => {
      const history = [
        {
          operation: 'delete',
          recordId: '2',
          correlationKey: 'req-1',
          previousValues: { title: 'Secret' },
          newValues: {},
        },
      ];
      const { services, dataSource, options } = setup(history);
      (services.authorization.getScope as jest.Mock).mockResolvedValue(
        new ConditionTreeLeaf('id', 'Equal', 1),
      );
      const list = jest.spyOn(dataSource.getCollection('books'), 'list');
      listAnswers.forEach(answer => list.mockResolvedValueOnce(answer as never));
      const route = new AuditTrailCorrelationRoute(services, options, dataSource);
      const context = contextWith({ timezone: 'Europe/Paris', collection: 'books', recordId: '2' });

      await route.handleHistory(context);

      return context;
    };

    test('withholds the values when the record was deleted in between', async () => {
      const context = await raceWith([{ id: 2 }], [], []);

      expect(context.throw).not.toHaveBeenCalled();
      expect((context.response.body as { data: unknown[] }).data).toEqual([
        {
          operation: 'delete',
          recordId: '2',
          correlationKey: 'req-1',
          previousValues: {},
          newValues: {},
        },
      ]);
    });

    test('refuses when the record moved out of the caller scope in between', async () => {
      const context = await raceWith([{ id: 2 }], [], [{ id: 2 }]);

      expect(context.throw).toHaveBeenCalledWith(404, 'Record does not exists');
      expect(context.response.body).toBeUndefined();
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
