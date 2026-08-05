import type PermissionsCache from './permissions-cache';
import type { EnvironmentAndUserPermissions, PermissionsFetcher } from './permissions-client';
import type { ResolvedApiKeyIdentity } from '../api-key/api-key-client';
import type { BffAccessTokenPayload } from '../oauth/bff-token';
import type { Logger } from '../ports/logger-port';
import type ReadModel from '../read-model/read-model';
import type ReadModelStore from '../read-model/read-model-store';
import type { UserPermissionV4 } from '@forestadmin/forestadmin-client';
import type { Context, Middleware } from 'koa';

import buildPermissionHints from './build-permission-hints';
import { buildCacheKey } from './permissions-cache';
import { resolveReadModel } from '../http/agent-route-helpers';
import { unauthorized } from '../http/bff-http-error';
import { forestIdentityNotAllowed, permissionsUnavailable } from '../http/bff-local-errors';

const PERMISSIONS_ROUTE = '/agent/v1/permissions';
const UNAVAILABLE_RETRY_AFTER_SECONDS = 5;

export interface PermissionsRoutesMiddlewareOptions {
  store: ReadModelStore;
  client: PermissionsFetcher;
  cache: PermissionsCache;
  envSecret: string;
  logger: Logger;
}

interface Caller {
  userId: number;
  cacheId: string;
}

function resolveCaller(ctx: Context): Caller {
  const principal = ctx.state.principal as BffAccessTokenPayload | undefined;

  if (principal) {
    return { userId: principal.id, cacheId: `oauth:${principal.id}:${principal.rendering_id}` };
  }

  const identity = ctx.state.apiKeyIdentity as ResolvedApiKeyIdentity | undefined;

  if (identity) {
    return { userId: identity.user.id, cacheId: `key:${identity.user.id}:${identity.renderingId}` };
  }

  throw unauthorized('No caller identity for this request');
}

function resolveRequestedCollections(ctx: Context, readModel: ReadModel): string[] {
  const raw = ctx.query.collections;
  const value = Array.isArray(raw) ? raw.join(',') : raw;
  const requested = (value ?? '')
    .split(',')
    .map(name => name.trim())
    .filter(name => name !== '');

  if (requested.length === 0) return readModel.getAllowedCollections();

  return [...new Set(requested.filter(name => readModel.isCollectionAllowed(name)))];
}

function findCallerRoleId(users: UserPermissionV4[], userId: number): number {
  const match = users.find(user => user.id === userId);

  if (!match) throw forestIdentityNotAllowed();

  return match.roleId;
}

export default function createPermissionsRoutesMiddleware({
  store,
  client,
  cache,
  envSecret,
  logger,
}: PermissionsRoutesMiddlewareOptions): Middleware {
  return async function permissionsRoutesMiddleware(ctx, next) {
    if (ctx.path !== PERMISSIONS_ROUTE || ctx.method !== 'GET') {
      await next();

      return;
    }

    const caller = resolveCaller(ctx);
    const readModel = await resolveReadModel(store);
    const collections = resolveRequestedCollections(ctx, readModel);
    const cacheKey = buildCacheKey({ envSecret, callerId: caller.cacheId, collections });

    const cached = cache.getFresh(cacheKey);

    if (cached) {
      ctx.status = 200;
      ctx.body = cached;

      return;
    }

    const generationAtRead = cache.currentGeneration;
    let resolved: EnvironmentAndUserPermissions;

    try {
      resolved = await client.fetchPermissions();
    } catch (error) {
      logger('Warn', 'Permission resolution failed', {
        cause: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      });

      const stillFresh = cache.getFresh(cacheKey);

      if (stillFresh) {
        ctx.status = 200;
        ctx.body = stillFresh;

        return;
      }

      throw permissionsUnavailable(UNAVAILABLE_RETRY_AFTER_SECONDS);
    }

    const roleId = findCallerRoleId(resolved.users, caller.userId);
    const hints = buildPermissionHints({
      environmentPermissions: resolved.environmentPermissions,
      roleId,
      readModel,
      collections,
    });

    cache.set(cacheKey, hints, generationAtRead);

    ctx.status = 200;
    ctx.body = hints;
  };
}
