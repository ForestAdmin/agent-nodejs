import type { AgentDataClient, AgentDataClientOptions } from './agent-data-client';
import type {
  CountRequestBody,
  ListRequestBody,
  RelationCountRequestBody,
  RelationListRequestBody,
} from './agent-query';
import type { Logger } from '../ports/logger-port';
import type ReadModel from '../read-model/read-model';
import type { PrimaryKeyField, RelationTarget } from '../read-model/read-model';
import type ReadModelStore from '../read-model/read-model-store';
import type { Context, Middleware } from 'koa';

import defaultCreateAgentDataClient from './agent-data-client';
import {
  buildCountAgentQuery,
  buildListAgentQuery,
  collectCountFieldPaths,
  collectListFieldPaths,
  parseCountRequest,
  parseListRequest,
  parseRelationCountRequest,
  parseRelationListRequest,
} from './agent-query';
import { mapCountResponse, mapListResponse } from './response-mappers';
import { mapAgentError } from '../http/agent-error-mapper';
import { unauthorized } from '../http/bff-http-error';
import {
  invalidRequest,
  schemaUnavailable,
  unknownCollection,
  unknownRelation,
} from '../http/bff-local-errors';
import SchemaUnavailableError from '../read-model/errors';
import assertNoRelationFieldPaths from '../validation/relation-field-guard';

const DATA_ROUTE = /^\/agent\/v1\/([^/]+)\/(list|count)$/;
const RELATION_ROUTE = /^\/agent\/v1\/([^/]+)\/relations\/([^/]+)\/(list|count)$/;

// Only to-many relations expose list/count on the agent; to-one relations get update-relation only.
// A polymorphic relation carrying multiple targets is always the to-one (PolymorphicManyToOne) side.
function resolveForeignCollection(target: RelationTarget | undefined): string | null {
  if (!target || !('target' in target)) return null;
  if (target.type !== 'HasMany' && target.type !== 'BelongsToMany') return null;

  return target.target;
}

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

function decodeSegment(raw: string, label: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    throw invalidRequest(`Malformed ${label} in path`);
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

// The parent drives ONLY route resolution (path + parentId); projection/filter/sort/count run on the
// foreign collection, so the agent query is built and the response mapped against the foreign side.
interface RelationHandlerDeps extends RequestHandlerDeps {
  relation: string;
  foreignCollection: string;
}

type RelationListHandlerDeps = RelationHandlerDeps & { primaryKeys: PrimaryKeyField[] };

async function handleRelationList(
  ctx: Context,
  body: RelationListRequestBody,
  deps: RelationListHandlerDeps,
) {
  // The nested-relation guard IS wired here: the agent's list-related asserts browse only on the
  // immediate foreign collection, so a nested `:`-path would traverse to a third collection whose
  // browse is never checked. Plain foreign fields (no `:`) are unaffected.
  assertNoRelationFieldPaths(collectListFieldPaths(body));

  const query = buildListAgentQuery(deps.foreignCollection, deps.timezone, body);
  const records = await callAgent(
    () => deps.client.listRelation(deps.collection, body.parentId, deps.relation, query),
    deps.logger,
  );

  ctx.status = 200;
  ctx.body = mapListResponse(deps.foreignCollection, records, deps.primaryKeys);
}

async function handleRelationCount(
  ctx: Context,
  body: RelationCountRequestBody,
  deps: RelationHandlerDeps,
) {
  assertNoRelationFieldPaths(collectCountFieldPaths(body));

  const query = buildCountAgentQuery(deps.timezone, body);
  const raw = await callAgent(
    () => deps.client.countRelationRaw(deps.collection, body.parentId, deps.relation, query),
    deps.logger,
  );

  ctx.status = 200;
  ctx.body = mapCountResponse(raw);
}

async function handleRelation(
  ctx: Context,
  rawBody: unknown,
  match: RegExpExecArray,
  { deps, readModel }: { deps: RequestHandlerDeps; readModel: ReadModel },
) {
  const relation = decodeSegment(match[2], 'relation name');
  const operation = match[3] as 'list' | 'count';

  // The URL identity (does this listable relation exist?) is resolved before the body,
  // so a bad path 404s before its payload is inspected.
  const foreignCollection = resolveForeignCollection(
    readModel.getRelationTarget(deps.collection, relation),
  );

  // TODO(PRD-672): the read-model's relation map is the allow-list, so an absent/to-one/polymorphic
  // relation cannot be told from a disallowed one — every non-listable relation maps to 404 here;
  // `relation_not_allowed` (403) has no local trigger, mirroring `collection_not_allowed`.
  if (!foreignCollection) {
    throw unknownRelation(`Unknown relation: ${deps.collection}.${relation}`);
  }

  // The agent's count-related authorizes only the parent, so an unguarded foreign collection would
  // leak a hidden collection's rows/count. Guard it here, mirroring the parent allow-list check.
  if (!readModel.isCollectionAllowed(foreignCollection)) {
    throw unknownCollection();
  }

  const relationDeps: RelationHandlerDeps = { ...deps, relation, foreignCollection };

  if (operation === 'list') {
    await handleRelationList(ctx, parseRelationListRequest(rawBody), {
      ...relationDeps,
      primaryKeys: readModel.getPrimaryKeys(foreignCollection),
    });
  } else {
    await handleRelationCount(ctx, parseRelationCountRequest(rawBody), relationDeps);
  }
}

export default function createDataRoutesMiddleware({
  store,
  agentUrl,
  logger,
  createClient = defaultCreateAgentDataClient,
}: DataRoutesMiddlewareOptions): Middleware {
  return async function dataRoutesMiddleware(ctx, next) {
    const dataMatch = DATA_ROUTE.exec(ctx.path);
    const relationMatch = dataMatch ? null : RELATION_ROUTE.exec(ctx.path);
    const match = dataMatch ?? relationMatch;

    if (!match || ctx.method !== 'POST') {
      await next();

      return;
    }

    const collection = decodeSegment(match[1], 'collection name');

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
    const rawBody = ctx.request.body ?? {};

    if (relationMatch) {
      await handleRelation(ctx, rawBody, relationMatch, { deps, readModel });

      return;
    }

    const operation = match[2] as 'list' | 'count';

    if (operation === 'list') {
      const body = parseListRequest(rawBody);
      await handleList(ctx, body, { ...deps, primaryKeys: readModel.getPrimaryKeys(collection) });
    } else {
      const body = parseCountRequest(rawBody);
      await handleCount(ctx, body, deps);
    }
  };
}
