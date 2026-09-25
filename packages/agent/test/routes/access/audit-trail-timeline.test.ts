import { ConditionTreeLeaf } from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';

import makeRoutes from '../../../src/routes';
import AuditTrailTimelineRoute from '../../../src/routes/access/audit-trail-timeline';
import * as factories from '../../__factories__';

describe('AuditTrailTimelineRoute', () => {
  const row = (id: number, patch: Record<string, unknown> = {}) => ({
    id,
    timestamp: `2026-01-0${id}T00:00:00.000Z`,
    operation: 'update',
    collection: 'books',
    recordId: '2',
    userId: 1,
    previousValues: { title: 'Old' },
    newValues: { title: 'New' },
    ...patch,
  });

  const setup = (timeline: unknown[] = []) => {
    const services = factories.forestAdminHttpDriverServices.build();
    const dataSource = factories.dataSource.buildWithCollections([
      factories.collection.build({
        name: 'books',
        schema: factories.collectionSchema.build({
          fields: { id: factories.columnSchema.numericPrimaryKey().build() },
        }),
      }),
      factories.collection.build({
        name: 'authors',
        schema: factories.collectionSchema.build({
          fields: { id: factories.columnSchema.numericPrimaryKey().build() },
        }),
      }),
    ]);
    const store = { listTimeline: jest.fn().mockResolvedValue(timeline) };
    const options = factories.forestAdminHttpDriverOptions.build({
      auditTrail: { connectionString: 'sqlite::memory:', store } as never,
    });
    const route = new AuditTrailTimelineRoute(services, options, dataSource);

    return { services, dataSource, options, store, route };
  };

  const contextWith = (query: Record<string, unknown> = {}, permissionLevel = 'admin') =>
    createMockContext({
      state: { user: { email: 'john.doe@domain.com', permissionLevel } },
      customProperties: { query: { timezone: 'Europe/Paris', ...query } },
    });

  test('registers the "/_audit-trail" route', () => {
    const { services, dataSource, options } = setup();
    const router = factories.router.mockAllMethods().build();

    new AuditTrailTimelineRoute(services, options, dataSource).setupRoutes(router);

    expect(router.get).toHaveBeenCalledWith('/_audit-trail', expect.any(Function));
  });

  test('reads every collection the caller can see, newest first', async () => {
    const timeline = [row(3, { collection: 'authors' }), row(2), row(1)];
    const { store, route } = setup(timeline);
    const context = contextWith();

    await route.handleTimeline(context);

    expect(store.listTimeline).toHaveBeenCalledWith(
      expect.objectContaining({ collections: ['books', 'authors'], limit: 21 }),
    );
    expect((context.response.body as { data: unknown[] }).data).toEqual(timeline);
  });

  test('leaves out a collection the caller cannot read', async () => {
    const { services, store, route } = setup();
    (services.authorization.canRead as jest.Mock).mockImplementation(
      async (_context, name) => name === 'books',
    );

    await route.handleTimeline(contextWith());

    expect(store.listTimeline).toHaveBeenCalledWith(
      expect.objectContaining({ collections: ['books'] }),
    );
  });

  test('leaves out a collection the caller only sees through a record-level scope', async () => {
    const { services, store, route } = setup();
    (services.authorization.getScope as jest.Mock).mockImplementation(async collection =>
      collection.name === 'authors' ? new ConditionTreeLeaf('id', 'Equal', 1) : null,
    );

    await route.handleTimeline(contextWith());

    expect(store.listTimeline).toHaveBeenCalledWith(
      expect.objectContaining({ collections: ['books'] }),
    );
  });

  test('returns an empty page without hitting the store when nothing is readable', async () => {
    const { services, store, route } = setup();
    (services.authorization.canRead as jest.Mock).mockResolvedValue(false);
    const context = contextWith();

    await route.handleTimeline(context);

    expect(store.listTimeline).not.toHaveBeenCalled();
    expect(context.response.body).toEqual({ data: [], meta: { cursor: null } });
  });

  test('forwards the filters and the page size to the store', async () => {
    const { store, route } = setup();

    await route.handleTimeline(
      contextWith({
        'page[size]': '5',
        userIds: '3,7',
        operation: 'create,delete',
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        search: '  jane  ',
      }),
    );

    expect(store.listTimeline).toHaveBeenCalledWith({
      collections: ['books', 'authors'],
      limit: 6,
      userIds: [3, 7],
      operations: ['create', 'delete'],
      startTimestamp: '2025-12-31T23:00:00.000Z',
      endTimestamp: '2026-01-31T22:59:59.999Z',
      search: 'jane',
      before: undefined,
      excludeIds: [],
    });
  });

  test('rejects an unrecognized operation before checking any permission', async () => {
    const { services, store, route } = setup();

    await expect(route.handleTimeline(contextWith({ operation: 'destroy' }))).rejects.toThrow(
      'Invalid operation: "destroy" (expected one of create, update, delete, action, action_failed)',
    );
    expect(services.authorization.canRead).not.toHaveBeenCalled();
    expect(store.listTimeline).not.toHaveBeenCalled();
  });

  describe('cursor', () => {
    test('returns no cursor when the page is the last one', async () => {
      const { route } = setup([row(2), row(1)]);
      const context = contextWith({ 'page[size]': '2' });

      await route.handleTimeline(context);

      expect(context.response.body).toEqual({
        data: [row(2), row(1)],
        meta: { cursor: null },
      });
    });

    test('drops the extra row and points the cursor at the last one returned', async () => {
      const { route } = setup([row(3), row(2), row(1)]);
      const context = contextWith({ 'page[size]': '2' });

      await route.handleTimeline(context);

      expect(context.response.body).toEqual({
        data: [row(3), row(2)],
        meta: { cursor: { before: '2026-01-02T00:00:00.000Z', excludeIds: [2] } },
      });
    });

    test('carries every id sharing the boundary timestamp so a tie cannot fall between pages', async () => {
      const tied = '2026-01-05T00:00:00.000Z';
      const { route } = setup([
        row(9, { timestamp: '2026-01-06T00:00:00.000Z' }),
        row(8, { timestamp: tied }),
        row(7, { timestamp: tied }),
        row(6, { timestamp: tied }),
      ]);
      const context = contextWith({ 'page[size]': '3' });

      await route.handleTimeline(context);

      expect((context.response.body as { meta: { cursor: unknown } }).meta.cursor).toEqual({
        before: tied,
        excludeIds: [8, 7],
      });
    });

    test('keeps the previous exclusions when the next page ends on the same timestamp', async () => {
      const tied = '2026-01-05T00:00:00.000Z';
      const { route } = setup([
        row(7, { timestamp: tied }),
        row(6, { timestamp: tied }),
        row(5, { timestamp: tied }),
      ]);
      const context = contextWith({
        'page[size]': '2',
        before: tied,
        excludeIds: '9,8',
      });

      await route.handleTimeline(context);

      expect((context.response.body as { meta: { cursor: unknown } }).meta.cursor).toEqual({
        before: tied,
        excludeIds: [9, 8, 7, 6],
      });
    });

    test('ends the walk rather than repeating a page the cursor cannot move past', async () => {
      const tied = '2026-01-05T00:00:00.000Z';
      // Every row is one the cursor already named: the exclusions cannot grow, so a further page
      // would return this same one forever.
      const { route } = setup([
        row(7, { timestamp: tied }),
        row(6, { timestamp: tied }),
        row(5, { timestamp: tied }),
      ]);
      const context = contextWith({ 'page[size]': '2', before: tied, excludeIds: '7,6' });

      await route.handleTimeline(context);

      expect(context.response.body).toEqual({
        data: [row(7, { timestamp: tied }), row(6, { timestamp: tied })],
        meta: { cursor: null },
      });
    });

    test('forwards the incoming cursor to the store as an inclusive bound', async () => {
      const { store, route } = setup();

      await route.handleTimeline(
        contextWith({ before: '2026-01-05T00:00:00.000Z', excludeIds: '4, 5 ,x' }),
      );

      expect(store.listTimeline).toHaveBeenCalledWith(
        expect.objectContaining({
          before: '2026-01-05T00:00:00.000Z',
          excludeIds: [4, 5],
        }),
      );
    });
  });

  test('blanks the values for a non-admin caller', async () => {
    const { route } = setup([row(1)]);
    const context = contextWith({}, 'editor');

    await route.handleTimeline(context);

    expect((context.response.body as { data: unknown[] }).data).toEqual([
      { ...row(1), previousValues: {}, newValues: {} },
    ]);
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

    test('mounts the timeline route when the store serves it', () => {
      const services = factories.forestAdminHttpDriverServices.build();
      const options = factories.forestAdminHttpDriverOptions.build({
        auditTrail: {
          connectionString: 'sqlite::memory:',
          store: { listTimeline: jest.fn() },
        } as never,
      });

      const routes = makeRoutes(buildDataSource(), options, services);

      expect(routes.filter(route => route instanceof AuditTrailTimelineRoute)).toHaveLength(1);
    });

    test('mounts no timeline route when the store does not serve it', () => {
      const services = factories.forestAdminHttpDriverServices.build();
      const options = factories.forestAdminHttpDriverOptions.build({
        auditTrail: { connectionString: 'sqlite::memory:', store: {} } as never,
      });

      const routes = makeRoutes(buildDataSource(), options, services);

      expect(routes.filter(route => route instanceof AuditTrailTimelineRoute)).toHaveLength(0);
    });
  });
});
