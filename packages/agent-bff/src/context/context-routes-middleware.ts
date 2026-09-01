import type ReadModelStore from '../read-model/read-model-store';
import type { Middleware } from 'koa';

import buildContext from './build-context';
import { resolveSchemaSnapshot } from '../http/agent-route-helpers';

const CONTEXT_ROUTE = '/agent/v1/context';

export interface ContextRoutesMiddlewareOptions {
  store: ReadModelStore;
  /**
   * Resolves to `undefined` rather than rejecting: the id decorates the payload, so a Forest server
   * that cannot answer must not take the whole bootstrap route down with it.
   */
  resolveEnvironmentId?: () => Promise<number | undefined>;
}

export default function createContextRoutesMiddleware({
  store,
  resolveEnvironmentId,
}: ContextRoutesMiddlewareOptions): Middleware {
  return async function contextRoutesMiddleware(ctx, next) {
    if (ctx.path !== CONTEXT_ROUTE || ctx.method !== 'GET') {
      await next();

      return;
    }

    const { collections, readModel, revision } = await resolveSchemaSnapshot(store);
    const environmentId = await resolveEnvironmentId?.();

    ctx.status = 200;
    ctx.body = buildContext(collections, readModel, { schemaRevision: revision, environmentId });
  };
}
