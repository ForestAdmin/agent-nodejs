import type ReadModelStore from '../read-model/read-model-store';
import type SchemaCache from '../read-model/schema-cache';
import type { ForestSchemaCollection } from '@forestadmin/forestadmin-client';
import type { Middleware } from 'koa';

import buildContext from './build-context';
import { resolveReadModel } from '../http/agent-route-helpers';
import { oauthRequired, schemaUnavailable } from '../http/bff-local-errors';
import SchemaUnavailableError from '../read-model/errors';

export const CONTEXT_ROUTE = '/agent/v1/context';

const MAX_GENERATION_RETRIES = 3;

export interface ContextRoutesMiddlewareOptions {
  store: ReadModelStore;
  schemaCache: SchemaCache;
}

async function readSchema(schemaCache: SchemaCache): Promise<ForestSchemaCollection[]> {
  try {
    return await schemaCache.get();
  } catch (error) {
    if (error instanceof SchemaUnavailableError) throw schemaUnavailable();
    throw error;
  }
}

async function buildStableContext(
  { store, schemaCache }: ContextRoutesMiddlewareOptions,
  attemptsLeft = MAX_GENERATION_RETRIES,
): Promise<ReturnType<typeof buildContext>> {
  if (attemptsLeft <= 0) {
    throw new Error('Schema generation kept changing while building the context contract');
  }

  const readModel = await resolveReadModel(store);
  const { revision } = schemaCache;
  const collections = await readSchema(schemaCache);

  if (schemaCache.revision !== revision) {
    return buildStableContext({ store, schemaCache }, attemptsLeft - 1);
  }

  return buildContext(collections, readModel, schemaCache.revision);
}

export default function createContextRoutesMiddleware(
  options: ContextRoutesMiddlewareOptions,
): Middleware {
  return async function contextRoutesMiddleware(ctx, next) {
    if (ctx.path !== CONTEXT_ROUTE || ctx.method !== 'GET') {
      await next();

      return;
    }

    if (ctx.state.authMode !== 'oauth') throw oauthRequired();

    ctx.status = 200;
    ctx.body = await buildStableContext(options);
  };
}
