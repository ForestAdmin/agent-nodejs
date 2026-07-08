import type { AgentDataClient, AgentDataClientOptions } from './agent-data-client';
import type { CountRequestBody, ListRequestBody } from './agent-query';
import type { Logger } from '../ports/logger-port';
import type ReadModel from '../read-model/read-model';
import type { PrimaryKeyField } from '../read-model/read-model';
import type ReadModelStore from '../read-model/read-model-store';
import type { Context, Middleware } from 'koa';

import defaultCreateAgentDataClient from './agent-data-client';
import {
  buildCountAgentQuery,
  buildListAgentQuery,
  collectCountFieldPaths,
  collectListFieldPaths,
} from './agent-query';
import { mapCountResponse, mapListResponse } from './response-mappers';
import { mapAgentError } from '../http/agent-error-mapper';
import { unauthorized } from '../http/bff-http-error';
import { invalidRequest, schemaUnavailable, unknownCollection } from '../http/bff-local-errors';
import SchemaUnavailableError from '../read-model/errors';
import assertNoRelationFieldPaths from '../validation/relation-field-guard';

const DATA_ROUTE = /^\/agent\/v1\/([^/]+)\/(list|count)$/;

export interface DataRoutesMiddlewareOptions {
  store: ReadModelStore;
  agentUrl: string;
  logger: Logger;
  createClient?: (options: AgentDataClientOptions) => AgentDataClient;
}

interface RequestHandlerDeps {
  collection: string;
  client: AgentDataClient;
  timezone: string;
  logger: Logger;
}

type ListHandlerDeps = RequestHandlerDeps & { primaryKeys: PrimaryKeyField[] };

function decodeCollection(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    throw invalidRequest('Malformed collection name in path');
  }
}

async function resolveReadModel(store: ReadModelStore): Promise<ReadModel> {
  try {
    return await store.getReadModel();
  } catch (error) {
    if (error instanceof SchemaUnavailableError) throw schemaUnavailable();
    throw error;
  }
}

// Only the agent call is wrapped: guard, query-building and mapping errors are BFF-origin and must
// keep their own type, not be recategorized as agent errors.
async function callAgent<T>(fn: () => Promise<T>, logger: Logger): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw mapAgentError(error, { logger });
  }
}

async function handleList(ctx: Context, body: ListRequestBody, deps: ListHandlerDeps) {
  assertNoRelationFieldPaths(collectListFieldPaths(body));

  const query = buildListAgentQuery(deps.collection, deps.timezone, body);
  const records = await callAgent(() => deps.client.list(deps.collection, query), deps.logger);

  ctx.status = 200;
  ctx.body = mapListResponse(deps.collection, records, deps.primaryKeys);
}

async function handleCount(ctx: Context, body: CountRequestBody, deps: RequestHandlerDeps) {
  assertNoRelationFieldPaths(collectCountFieldPaths(body));

  const query = buildCountAgentQuery(deps.timezone, body);
  const raw = await callAgent(() => deps.client.countRaw(deps.collection, query), deps.logger);

  ctx.status = 200;
  ctx.body = mapCountResponse(raw);
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

    const collection = decodeCollection(match[1]);
    const operation = match[2] as 'list' | 'count';

    // The agent token is minted only on the API-key path; the OAuth path sets a principal but no
    // agent token yet. Fail closed instead of calling the agent with `Bearer undefined`.
    // TODO(PRD-637): mint an agent token from the OAuth principal so data routes work in OAuth mode.
    const token = ctx.state.agentToken as string | undefined;
    if (!token) throw unauthorized('No agent credentials for this request');

    const readModel = await resolveReadModel(store);

    if (!readModel.isCollectionAllowed(collection)) {
      // TODO(PRD-671): the read-model exposes a single allow-list (the exposed collections), so it
      // cannot tell an unknown collection from a known-but-disallowed one. Every absent name maps
      // to 404 here; `collection_not_allowed` (403) has no local trigger until a distinct exposure
      // source exists. Escalated on the ticket — revisit when Anthony answers.
      throw unknownCollection(`Unknown collection: ${collection}`);
    }

    const deps: RequestHandlerDeps = {
      collection,
      client: createClient({ agentUrl, token }),
      timezone: ctx.state.timezone as string,
      logger,
    };
    const body = (ctx.request.body ?? {}) as ListRequestBody & CountRequestBody;

    if (operation === 'list') {
      await handleList(ctx, body, { ...deps, primaryKeys: readModel.getPrimaryKeys(collection) });
    } else {
      await handleCount(ctx, body, deps);
    }
  };
}
