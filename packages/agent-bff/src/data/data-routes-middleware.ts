import type { AgentDataClient, AgentDataClientOptions } from './agent-data-client';
import type { CountRequestBody, ListRequestBody } from './agent-query';
import type { Logger } from '../ports/logger-port';
import type ReadModelStore from '../read-model/read-model-store';
import type { Middleware } from 'koa';

import defaultCreateAgentDataClient from './agent-data-client';
import {
  buildCountAgentQuery,
  buildListAgentQuery,
  collectCountFieldPaths,
  collectListFieldPaths,
} from './agent-query';
import { mapCountResponse, mapListResponse } from './response-mappers';
import { mapAgentError } from '../http/agent-error-mapper';
import { schemaUnavailable, unknownCollection } from '../http/bff-local-errors';
import SchemaUnavailableError from '../read-model/errors';
import assertNoRelationFieldPaths from '../validation/relation-field-guard';

const DATA_ROUTE = /^\/agent\/v1\/([^/]+)\/(list|count)$/;

export interface DataRoutesMiddlewareOptions {
  store: ReadModelStore;
  agentUrl: string;
  logger: Logger;
  createClient?: (options: AgentDataClientOptions) => AgentDataClient;
}

async function resolveReadModel(store: ReadModelStore) {
  try {
    return await store.getReadModel();
  } catch (error) {
    if (error instanceof SchemaUnavailableError) throw schemaUnavailable();
    throw error;
  }
}

export default function createDataRoutesMiddleware({
  store,
  agentUrl,
  logger,
  createClient = defaultCreateAgentDataClient,
}: DataRoutesMiddlewareOptions): Middleware {
  return async function dataRoutesMiddleware(ctx, next) {
    const match = DATA_ROUTE.exec(ctx.path);

    if (!match || ctx.method !== 'POST') {
      await next();

      return;
    }

    const collection = decodeURIComponent(match[1]);
    const operation = match[2] as 'list' | 'count';

    const readModel = await resolveReadModel(store);

    if (!readModel.isCollectionAllowed(collection)) {
      // TODO(PRD-671): the read-model exposes a single allow-list (the exposed collections), so it
      // cannot tell an unknown collection from a known-but-disallowed one. Every absent name maps
      // to 404 here; `collection_not_allowed` (403) has no local trigger until a distinct exposure
      // source exists. Escalated on the ticket — revisit when Anthony answers.
      throw unknownCollection(`Unknown collection: ${collection}`);
    }

    const timezone = ctx.state.timezone as string;
    const token = ctx.state.agentToken as string;
    const client = createClient({ agentUrl, token });
    const body = (ctx.request.body ?? {}) as ListRequestBody & CountRequestBody;

    if (operation === 'list') {
      assertNoRelationFieldPaths(collectListFieldPaths(body));

      const query = buildListAgentQuery(collection, timezone, body);
      let records: Record<string, unknown>[];

      try {
        records = await client.list(collection, query);
      } catch (error) {
        throw mapAgentError(error, { logger });
      }

      ctx.status = 200;
      ctx.body = mapListResponse(collection, records, readModel.getPrimaryKeys(collection));

      return;
    }

    assertNoRelationFieldPaths(collectCountFieldPaths(body));

    const query = buildCountAgentQuery(timezone, body);
    let raw: unknown;

    try {
      raw = await client.countRaw(collection, query);
    } catch (error) {
      throw mapAgentError(error, { logger });
    }

    ctx.status = 200;
    ctx.body = mapCountResponse(raw);
  };
}
