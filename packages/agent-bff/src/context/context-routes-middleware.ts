import type ReadModelStore from '../read-model/read-model-store';
import type { SchemaSnapshot } from '../read-model/read-model-store';
import type { Middleware } from 'koa';

import buildContext from './build-context';
import { oauthRequired, schemaUnavailable } from '../http/bff-local-errors';
import SchemaUnavailableError from '../read-model/errors';

const CONTEXT_ROUTE = '/agent/v1/context';

export interface ContextRoutesMiddlewareOptions {
  store: ReadModelStore;
  environmentId?: number;
}

async function readSnapshot(store: ReadModelStore): Promise<SchemaSnapshot> {
  try {
    return await store.getSchemaSnapshot();
  } catch (error) {
    if (error instanceof SchemaUnavailableError) throw schemaUnavailable();
    throw error;
  }
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

    if (ctx.state.authMode !== 'oauth') throw oauthRequired();

    const { collections, readModel, revision } = await readSnapshot(store);

    ctx.status = 200;
    ctx.body = buildContext(collections, readModel, { schemaRevision: revision, environmentId });
  };
}
