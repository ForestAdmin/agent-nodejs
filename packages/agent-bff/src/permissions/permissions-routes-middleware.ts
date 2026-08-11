import type PermissionsCache from './permissions-cache';
import type { EvaluatedPermissions } from './permissions-cache';
import type { EnvironmentAndUserPermissions, PermissionsFetcher } from './permissions-client';
import type { ResolvedApiKeyIdentity } from '../api-key/api-key-client';
import type { BffAccessTokenPayload } from '../oauth/bff-token';
import type { Logger } from '../ports/logger-port';
import type ReadModel from '../read-model/read-model';
import type ReadModelStore from '../read-model/read-model-store';
import type { UserPermissionV4 } from '@forestadmin/forestadmin-client';
import type { Context, Middleware } from 'koa';

import { generateActionsFromPermissions } from '@forestadmin/forestadmin-client';

import buildPermissionHints from './build-permission-hints';
import { resolveReadModel } from '../http/agent-route-helpers';
import { unauthorized } from '../http/bff-http-error';
import { forestIdentityNotAllowed, permissionsUnavailable } from '../http/bff-local-errors';

const PERMISSIONS_ROUTE = '/agent/v1/permissions';
const UNAVAILABLE_RETRY_AFTER_SECONDS = 5;

export interface PermissionsRoutesMiddlewareOptions {
  store: ReadModelStore;
  client: PermissionsFetcher;
  cache: PermissionsCache;
  logger: Logger;
}

interface Caller {
  userId: number;
}

function resolveCaller(ctx: Context): Caller {
  const principal = ctx.state.principal as BffAccessTokenPayload | undefined;

  if (principal) return { userId: principal.id };

  const identity = ctx.state.apiKeyIdentity as ResolvedApiKeyIdentity | undefined;

  if (identity) return { userId: identity.user.id };

  throw unauthorized('No caller identity for this request');
}

function resolveRequestedCollections(ctx: Context, readModel: ReadModel): string[] {
  const raw = ctx.query.collections;

  if (raw === undefined) return readModel.getAllowedCollections();

  const value = Array.isArray(raw) ? raw.join(',') : raw;
  const requested = value
    .split(',')
    .map(name => name.trim())
    .filter(name => name !== '');

  return [...new Set(requested.filter(name => readModel.isCollectionAllowed(name)))];
}

function findCallerRoleId(users: UserPermissionV4[], userId: number): number | undefined {
  return users.find(user => user.id === userId)?.roleId;
}

async function resolvePermissions({
  cache,
  client,
  logger,
}: {
  cache: PermissionsCache;
  client: PermissionsFetcher;
  logger: Logger;
}): Promise<EvaluatedPermissions> {
  let resolved: EnvironmentAndUserPermissions;

  try {
    resolved = await client.fetchPermissions();
  } catch (error) {
    logger('Warn', 'Permission resolution failed', {
      cause: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    });

    const stillFresh = cache.getFresh();

    if (stillFresh) return stillFresh;

    throw permissionsUnavailable(UNAVAILABLE_RETRY_AFTER_SECONDS);
  }

  const permissions: EvaluatedPermissions = {
    actionPermissions: generateActionsFromPermissions(resolved.environmentPermissions),
    users: resolved.users,
  };

  cache.set(permissions);

  return permissions;
}

async function resolveCallerPermissions({
  caller,
  cache,
  client,
  logger,
}: {
  caller: Caller;
  cache: PermissionsCache;
  client: PermissionsFetcher;
  logger: Logger;
}): Promise<{ permissions: EvaluatedPermissions; roleId: number }> {
  const cached = cache.getFresh();
  const cachedRoleId = cached && findCallerRoleId(cached.users, caller.userId);

  if (cached && cachedRoleId !== undefined) {
    return { permissions: cached, roleId: cachedRoleId };
  }

  if (cached) cache.clear();

  const permissions = await resolvePermissions({ cache, client, logger });
  const roleId = findCallerRoleId(permissions.users, caller.userId);

  if (roleId === undefined) throw forestIdentityNotAllowed();

  return { permissions, roleId };
}

export default function createPermissionsRoutesMiddleware({
  store,
  client,
  cache,
  logger,
}: PermissionsRoutesMiddlewareOptions): Middleware {
  return async function permissionsRoutesMiddleware(ctx, next) {
    if (ctx.path !== PERMISSIONS_ROUTE || ctx.method !== 'GET') {
      await next();

      return;
    }

    const caller = resolveCaller(ctx);
    const { permissions, roleId } = await resolveCallerPermissions({
      caller,
      cache,
      client,
      logger,
    });

    const readModel = await resolveReadModel(store);
    const collections = resolveRequestedCollections(ctx, readModel);

    ctx.status = 200;
    ctx.body = buildPermissionHints({
      actionPermissions: permissions.actionPermissions,
      roleId,
      readModel,
      collections,
    });
  };
}
