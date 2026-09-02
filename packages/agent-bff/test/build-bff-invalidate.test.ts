import type { EvaluatedPermissions } from '../src/permissions/permissions-cache';
import type { PermissionsRoutesMiddlewareOptions } from '../src/permissions/permissions-routes-middleware';
import type { Logger } from '../src/ports/logger-port';

import buildBff from '../src/build-bff';
import { restoreFetchAfterEach, stubEnvironmentIdFetch } from './helpers/fetch-stub';
import { parseConfig } from '../src/config/env-config';
import createPermissionsRoutesMiddleware from '../src/permissions/permissions-routes-middleware';

jest.mock('../src/permissions/permissions-routes-middleware', () => ({
  __esModule: true,
  default: jest.fn(() => async (_ctx: unknown, next: () => Promise<void>) => next()),
}));

const VALID_ENV = {
  FOREST_AUTH_SECRET: 'auth-secret',
  FOREST_ENV_SECRET: 'env-secret',
  FOREST_SERVER_URL: 'https://api.forestadmin.com',
  FOREST_APP_URL: 'https://app.forestadmin.com',
  AGENT_URL: 'https://agent.example.com',
  BFF_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32).toString('base64'),
} satisfies NodeJS.ProcessEnv;

const PERMISSIONS = {
  actionPermissions: {
    isDevelopment: false,
    actionsGloballyAllowed: new Set<string>(),
    actionsByRole: new Map(),
  },
  users: [{ id: 1, roleId: 7 }],
} as unknown as EvaluatedPermissions;

const noopLogger: Logger = () => undefined;

const mounted = createPermissionsRoutesMiddleware as unknown as jest.Mock;

function permissionsRouteOptions(): PermissionsRoutesMiddlewareOptions {
  return mounted.mock.calls[0][0] as PermissionsRoutesMiddlewareOptions;
}

describe('buildBff invalidate', () => {
  restoreFetchAfterEach();

  beforeEach(() => {
    mounted.mockClear();
    stubEnvironmentIdFetch();
  });

  describe('when the agent edge is mounted', () => {
    it('should drop the entry from the very cache the permissions route reads', async () => {
      const bff = await buildBff({ config: parseConfig(VALID_ENV), logger: noopLogger });
      const { cache } = permissionsRouteOptions();
      cache.set(PERMISSIONS, cache.generation);

      bff.invalidate();

      expect(cache.getFresh()).toBeUndefined();
    });

    it('should invalidate the very store the permissions route reads', async () => {
      const bff = await buildBff({ config: parseConfig(VALID_ENV), logger: noopLogger });
      const { store } = permissionsRouteOptions();
      const invalidate = jest.spyOn(store, 'invalidate');

      bff.invalidate();

      expect(invalidate).toHaveBeenCalledTimes(1);
    });

    it('should log the invalidation, the only trace an operator can correlate against', async () => {
      const logger = jest.fn();
      const bff = await buildBff({ config: parseConfig(VALID_ENV), logger });
      logger.mockClear();

      bff.invalidate();

      expect(logger).toHaveBeenCalledWith('Info', 'Dropping the SaaS read caches on host request');
    });
  });

  describe('when the read-model bundle is absent but the auth secret is present', () => {
    it('should mount no permissions route and stay safe to invalidate', async () => {
      const bff = await buildBff({
        config: parseConfig({ ...VALID_ENV, FOREST_ENV_SECRET: undefined }),
        logger: noopLogger,
      });

      expect(() => bff.invalidate()).not.toThrow();
      expect(mounted).not.toHaveBeenCalled();
    });
  });
});
