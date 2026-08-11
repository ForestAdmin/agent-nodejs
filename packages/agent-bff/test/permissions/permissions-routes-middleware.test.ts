import type { PermissionsFetcher } from '../../src/permissions/permissions-client';
import type { Logger } from '../../src/ports/logger-port';
import type ReadModelStore from '../../src/read-model/read-model-store';
import type { EnvironmentPermissionsV4, UserPermissionV4 } from '@forestadmin/forestadmin-client';
import type { Middleware } from 'koa';

import { generateActionsFromPermissions } from '@forestadmin/forestadmin-client';
import Koa from 'koa';
import request from 'supertest';

import createErrorMiddleware from '../../src/http/error-middleware';
import PermissionsCache, {
  PERMISSIONS_CACHE_TTL_MS,
} from '../../src/permissions/permissions-cache';
import createPermissionsRoutesMiddleware from '../../src/permissions/permissions-routes-middleware';
import ReadModel from '../../src/read-model/read-model';
import { action, collection, column } from '../read-model/fixtures';

const ADMIN_ROLE = 1;
const VIEWER_ROLE = 2;
const CALLER_ID = 42;
const VIEWER_ID = 99;
const ROUTE = '/agent/v1/permissions';

const noopLogger: Logger = () => {};

function crud(roles: number[]) {
  return {
    browseEnabled: { roles },
    readEnabled: { roles },
    editEnabled: { roles },
    addEnabled: { roles },
    deleteEnabled: { roles },
    exportEnabled: { roles },
  };
}

function smartAction(roles: number[]) {
  return {
    triggerEnabled: { roles },
    triggerConditions: [],
    approvalRequired: { roles: [] },
    approvalRequiredConditions: [],
    userApprovalEnabled: { roles: [] },
    userApprovalConditions: [],
    selfApprovalEnabled: { roles: [] },
  };
}

const NORMAL_MODE = {
  collections: {
    users: { collection: crud([ADMIN_ROLE]), actions: { 'Block user': smartAction([ADMIN_ROLE]) } },
    orders: { collection: crud([ADMIN_ROLE]), actions: {} },
  },
} as unknown as EnvironmentPermissionsV4;

const USERS: UserPermissionV4[] = [
  { id: CALLER_ID, roleId: ADMIN_ROLE } as UserPermissionV4,
  { id: VIEWER_ID, roleId: VIEWER_ROLE } as UserPermissionV4,
];

function readModel(): ReadModel {
  return new ReadModel([
    collection('users', [column('id'), column('email')], [action('Block user', '/block')]),
    collection('orders', [column('id')]),
  ]);
}

function storeOf(model = readModel()): ReadModelStore {
  return { getReadModel: async () => model } as unknown as ReadModelStore;
}

function fetcherOf(
  result: { environmentPermissions: EnvironmentPermissionsV4; users: UserPermissionV4[] } | Error,
): jest.Mocked<PermissionsFetcher> {
  return {
    fetchPermissions: jest.fn(async () => {
      if (result instanceof Error) throw result;

      return result;
    }),
  };
}

function principalMiddleware(id: number | null): Middleware {
  return async (ctx, next) => {
    if (id !== null) {
      ctx.state.principal = { id, email: `user-${id}@example.com`, rendering_id: '7' };
    }

    await next();
  };
}

function appOf({
  client,
  cache = new PermissionsCache(),
  callerId = CALLER_ID as number | null,
  store = storeOf(),
}: {
  client: PermissionsFetcher;
  cache?: PermissionsCache;
  callerId?: number | null;
  store?: ReadModelStore;
}) {
  const app = new Koa();
  app.use(createErrorMiddleware({ logger: noopLogger }));
  app.use(principalMiddleware(callerId));
  app.use(
    createPermissionsRoutesMiddleware({
      store,
      client,
      cache,
      logger: noopLogger,
    }),
  );

  return app;
}

describe('createPermissionsRoutesMiddleware', () => {
  describe('when a known caller requests two collections', () => {
    it('should return CRUD and action hints for both without exposing the roleId', async () => {
      const client = fetcherOf({ environmentPermissions: NORMAL_MODE, users: USERS });

      const response = await request(appOf({ client }).callback())
        .get(ROUTE)
        .query({ collections: 'users,orders' });

      expect(response.status).toBe(200);
      expect(Object.keys(response.body.collections).sort()).toEqual(['orders', 'users']);
      expect(response.body.collections.users.crud.browse).toBe(true);
      expect(response.body.visibleActions).toEqual(['users.Block user']);
      expect(JSON.stringify(response.body)).not.toContain('roleId');
    });
  });

  describe('when no collections query parameter is given', () => {
    it('should fall back to every exposed collection', async () => {
      const client = fetcherOf({ environmentPermissions: NORMAL_MODE, users: USERS });

      const response = await request(appOf({ client }).callback()).get(ROUTE);

      expect(response.status).toBe(200);
      expect(Object.keys(response.body.collections).sort()).toEqual(['orders', 'users']);
    });
  });

  describe('when the collections parameter is present but empty', () => {
    it('should scope to nothing rather than falling back to every collection', async () => {
      const client = fetcherOf({ environmentPermissions: NORMAL_MODE, users: USERS });

      const response = await request(appOf({ client }).callback()).get(`${ROUTE}?collections=`);

      expect(response.status).toBe(200);
      expect(response.body.collections).toEqual({});
      expect(response.body.visibleActions).toEqual([]);
    });
  });

  describe('when the collections parameter is repeated in the query string', () => {
    it('should merge every occurrence into one scope', async () => {
      const client = fetcherOf({ environmentPermissions: NORMAL_MODE, users: USERS });

      const response = await request(appOf({ client }).callback()).get(
        `${ROUTE}?collections=users&collections=orders`,
      );

      expect(response.status).toBe(200);
      expect(Object.keys(response.body.collections).sort()).toEqual(['orders', 'users']);
    });
  });

  describe('when the permission fetch rejects with a non-Error value', () => {
    it('should still fail closed with 503', async () => {
      const client: PermissionsFetcher = {
        fetchPermissions: jest.fn(async () => {
          // eslint-disable-next-line @typescript-eslint/no-throw-literal
          throw 'plain string failure';
        }),
      };

      const response = await request(appOf({ client }).callback()).get(ROUTE);

      expect(response.status).toBe(503);
      expect(response.body.error.type).toBe('permissions_unavailable');
    });
  });

  describe('when a requested collection is not exposed by the schema', () => {
    it('should omit it instead of returning all-false or failing', async () => {
      const client = fetcherOf({ environmentPermissions: NORMAL_MODE, users: USERS });

      const response = await request(appOf({ client }).callback())
        .get(ROUTE)
        .query({ collections: 'users,ghosts' });

      expect(response.status).toBe(200);
      expect(Object.keys(response.body.collections)).toEqual(['users']);
    });
  });

  describe('when a caller absent from the cached users payload calls in', () => {
    it('should refetch once and serve them rather than returning a stale 403', async () => {
      const cache = new PermissionsCache();
      cache.set({
        actionPermissions: generateActionsFromPermissions(NORMAL_MODE),
        users: [{ id: CALLER_ID, roleId: ADMIN_ROLE } as UserPermissionV4],
      });
      const client = fetcherOf({ environmentPermissions: NORMAL_MODE, users: USERS });

      const response = await request(appOf({ client, cache, callerId: VIEWER_ID }).callback())
        .get(ROUTE)
        .query({ collections: 'users' });

      expect(response.status).toBe(200);
      expect(client.fetchPermissions).toHaveBeenCalledTimes(1);
      expect(response.body.collections.users.crud.browse).toBe(false);
    });
  });

  describe('when the refetch triggered by an unknown caller fails', () => {
    it('should keep serving the cached permissions to the callers they cover', async () => {
      const cache = new PermissionsCache();
      cache.set({
        actionPermissions: generateActionsFromPermissions(NORMAL_MODE),
        users: [{ id: CALLER_ID, roleId: ADMIN_ROLE } as UserPermissionV4],
      });
      const client = fetcherOf(new Error('SaaS down'));

      const unknown = await request(appOf({ client, cache, callerId: VIEWER_ID }).callback())
        .get(ROUTE)
        .query({ collections: 'users' });
      const known = await request(appOf({ client, cache }).callback())
        .get(ROUTE)
        .query({ collections: 'users' });

      expect(unknown.status).toBe(403);
      expect(known.status).toBe(200);
      expect(known.body.collections.users.crud.browse).toBe(true);
    });
  });

  describe('when the caller is absent from the users payload', () => {
    it('should return 403 forest_identity_not_allowed', async () => {
      const client = fetcherOf({ environmentPermissions: NORMAL_MODE, users: [] });

      const response = await request(appOf({ client }).callback()).get(ROUTE);

      expect(response.status).toBe(403);
      expect(response.body.error.type).toBe('forest_identity_not_allowed');
    });
  });

  describe('when the request carries no caller identity', () => {
    it('should return 401 unauthorized without calling the SaaS', async () => {
      const client = fetcherOf({ environmentPermissions: NORMAL_MODE, users: USERS });

      const response = await request(appOf({ client, callerId: null }).callback()).get(ROUTE);

      expect(response.status).toBe(401);
      expect(response.body.error.type).toBe('unauthorized');
      expect(client.fetchPermissions).not.toHaveBeenCalled();
    });
  });

  describe('when the permission fetch fails and no fresh entry is cached', () => {
    it('should return 503 permissions_unavailable with Retry-After', async () => {
      const client = fetcherOf(new Error('SaaS down'));

      const response = await request(appOf({ client }).callback()).get(ROUTE);

      expect(response.status).toBe(503);
      expect(response.body.error.type).toBe('permissions_unavailable');
      expect(response.headers['retry-after']).toBe('5');
    });
  });

  describe('when the permission fetch fails but a fresh entry was cached', () => {
    it('should serve the cached hints', async () => {
      const cache = new PermissionsCache();
      const healthy = fetcherOf({ environmentPermissions: NORMAL_MODE, users: USERS });
      await request(appOf({ client: healthy, cache }).callback()).get(ROUTE);

      const failing = fetcherOf(new Error('SaaS down'));
      const response = await request(appOf({ client: failing, cache }).callback()).get(ROUTE);

      expect(response.status).toBe(200);
      expect(Object.keys(response.body.collections).sort()).toEqual(['orders', 'users']);
      expect(failing.fetchPermissions).not.toHaveBeenCalled();
    });
  });

  describe('when the same caller asks twice for the same collections', () => {
    it('should fetch the permissions only once', async () => {
      const cache = new PermissionsCache();
      const client = fetcherOf({ environmentPermissions: NORMAL_MODE, users: USERS });
      const app = appOf({ client, cache });

      await request(app.callback()).get(ROUTE).query({ collections: 'users' });
      await request(app.callback()).get(ROUTE).query({ collections: 'users' });

      expect(client.fetchPermissions).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the same caller asks for a different collections set', () => {
    it('should reuse the cached permissions and scope the response to that set', async () => {
      const cache = new PermissionsCache();
      const client = fetcherOf({ environmentPermissions: NORMAL_MODE, users: USERS });
      const app = appOf({ client, cache });

      const first = await request(app.callback()).get(ROUTE).query({ collections: 'users' });
      const second = await request(app.callback())
        .get(ROUTE)
        .query({ collections: 'users,orders' });

      expect(client.fetchPermissions).toHaveBeenCalledTimes(1);
      expect(Object.keys(first.body.collections)).toEqual(['users']);
      expect(Object.keys(second.body.collections).sort()).toEqual(['orders', 'users']);
    });
  });

  describe('when a concurrent request populates the cache while this fetch fails', () => {
    it('should serve the entry that landed during the failed fetch', async () => {
      const cache = new PermissionsCache();
      const client: PermissionsFetcher = {
        fetchPermissions: jest.fn(async () => {
          cache.set({
            actionPermissions: generateActionsFromPermissions(NORMAL_MODE),
            users: USERS,
          });

          throw new Error('SaaS down');
        }),
      };

      const response = await request(appOf({ client, cache }).callback())
        .get(ROUTE)
        .query({ collections: 'users' });

      expect(response.status).toBe(200);
      expect(response.body.visibleActions).toEqual(['users.Block user']);
      expect(client.fetchPermissions).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the same collection is requested twice in the query', () => {
    it('should deduplicate it in visibleActions and reuse the single-name cache entry', async () => {
      const cache = new PermissionsCache();
      const client = fetcherOf({ environmentPermissions: NORMAL_MODE, users: USERS });
      const app = appOf({ client, cache });

      const duplicated = await request(app.callback())
        .get(ROUTE)
        .query({ collections: 'users,users' });
      await request(app.callback()).get(ROUTE).query({ collections: 'users' });

      expect(duplicated.body.visibleActions).toEqual(['users.Block user']);
      expect(client.fetchPermissions).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the permission fetch fails and the only cached entry has expired', () => {
    it('should return 503 rather than serving the expired hints', async () => {
      let clock = 1_000;
      const cache = new PermissionsCache({ now: () => clock });

      const healthy = fetcherOf({ environmentPermissions: NORMAL_MODE, users: USERS });
      await request(appOf({ client: healthy, cache }).callback()).get(ROUTE);

      clock += PERMISSIONS_CACHE_TTL_MS;

      const failing = fetcherOf(new Error('SaaS down'));
      const response = await request(appOf({ client: failing, cache }).callback()).get(ROUTE);

      expect(response.status).toBe(503);
      expect(response.body.error.type).toBe('permissions_unavailable');
      expect(failing.fetchPermissions).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the caller authenticated with a BFF API key', () => {
    it('should resolve the role from the API key identity', async () => {
      const client = fetcherOf({ environmentPermissions: NORMAL_MODE, users: USERS });
      const app = new Koa();
      app.use(createErrorMiddleware({ logger: noopLogger }));
      app.use(async (ctx, next) => {
        ctx.state.apiKeyIdentity = {
          user: { id: CALLER_ID, email: 'key@example.com' },
          renderingId: 7,
          allowedOrigins: [],
        };
        await next();
      });
      app.use(
        createPermissionsRoutesMiddleware({
          store: storeOf(),
          client,
          cache: new PermissionsCache(),
          logger: noopLogger,
        }),
      );

      const response = await request(app.callback()).get(ROUTE).query({ collections: 'users' });

      expect(response.status).toBe(200);
      expect(response.body.collections.users.crud.browse).toBe(true);
      expect(response.body.visibleActions).toEqual(['users.Block user']);
    });
  });

  describe('when a different caller asks for the same collections', () => {
    it('should reuse the cached permissions and resolve that caller role from them', async () => {
      const cache = new PermissionsCache();
      const client = fetcherOf({ environmentPermissions: NORMAL_MODE, users: USERS });

      const first = await request(appOf({ client, cache }).callback())
        .get(ROUTE)
        .query({ collections: 'users' });
      const second = await request(appOf({ client, cache, callerId: VIEWER_ID }).callback())
        .get(ROUTE)
        .query({ collections: 'users' });

      expect(client.fetchPermissions).toHaveBeenCalledTimes(1);
      expect(first.body.collections.users.crud.browse).toBe(true);
      expect(second.body.collections.users.crud.browse).toBe(false);
    });
  });

  describe('when the read model is resolved for a request', () => {
    it('should resolve it once per request', async () => {
      const getReadModel = jest.fn(async () => readModel());
      const store = { getReadModel } as unknown as ReadModelStore;
      const client = fetcherOf({ environmentPermissions: NORMAL_MODE, users: USERS });

      const response = await request(appOf({ client, store }).callback())
        .get(ROUTE)
        .query({ collections: 'users' });

      expect(response.status).toBe(200);
      expect(getReadModel).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the schema changed since the permissions were cached', () => {
    it('should build the hints from the current schema rather than a stale one', async () => {
      const cache = new PermissionsCache();
      const client = fetcherOf({ environmentPermissions: NORMAL_MODE, users: USERS });
      let current = readModel();
      const store = { getReadModel: async () => current } as unknown as ReadModelStore;

      const first = await request(appOf({ client, cache, store }).callback())
        .get(ROUTE)
        .query({ collections: 'users' });

      current = new ReadModel([collection('users', [column('id')])]);

      const second = await request(appOf({ client, cache, store }).callback())
        .get(ROUTE)
        .query({ collections: 'users' });

      expect(client.fetchPermissions).toHaveBeenCalledTimes(1);
      expect(first.body.visibleActions).toEqual(['users.Block user']);
      expect(second.body.visibleActions).toEqual([]);
    });
  });

  describe('when the schema is refreshed while the permissions are being fetched', () => {
    it('should answer from the refreshed read model, not the superseded one', async () => {
      const cache = new PermissionsCache();
      const refreshed = new ReadModel([
        collection('orders', [column('id')], [action('Refund order', '/refund')]),
      ]);
      let current = readModel();
      const store = {
        getReadModel: async () => current,
      } as unknown as ReadModelStore;
      const client: PermissionsFetcher = {
        fetchPermissions: jest.fn(async () => {
          current = refreshed;
          cache.clear();

          return { environmentPermissions: NORMAL_MODE, users: USERS };
        }),
      };

      const response = await request(appOf({ client, cache, store }).callback()).get(ROUTE);

      expect(response.status).toBe(200);
      expect(Object.keys(response.body.collections)).toEqual(['orders']);
      expect(cache.size).toBe(1);
    });
  });

  describe('when the path or the method does not match', () => {
    it('should fall through to the next middleware', async () => {
      const client = fetcherOf({ environmentPermissions: NORMAL_MODE, users: USERS });
      const app = appOf({ client });
      app.use(async ctx => {
        ctx.status = 204;
      });

      const posted = await request(app.callback()).post(ROUTE);
      const other = await request(app.callback()).get('/agent/v1/users/list');

      expect(posted.status).toBe(204);
      expect(other.status).toBe(204);
      expect(client.fetchPermissions).not.toHaveBeenCalled();
    });
  });
});
