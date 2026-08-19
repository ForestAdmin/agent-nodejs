import type ReadModelStore from '../read-model/read-model-store';
import type { Middleware } from 'koa';

import buildContext from './build-context';
import { resolveSchemaSnapshot } from '../http/agent-route-helpers';

const CONTEXT_ROUTE = '/agent/v1/context';

export interface ContextRoutesMiddlewareOptions {
  store: ReadModelStore;
  environmentId?: number;
}

export default function createContextRoutesMiddleware({
  store,
  environmentId,
}: ContextRoutesMiddlewareOptions): Middleware {
  return async function contextRoutesMiddleware(ctx, next) {
    if (ctx.path !== CONTEXT_ROUTE || ctx.method !== 'GET') {
      await next();

      return;
    }

    const { collections, readModel, revision } = await resolveSchemaSnapshot(store);

    ctx.status = 200;
    ctx.body = buildContext(collections, readModel, { schemaRevision: revision, environmentId });
  };
}
