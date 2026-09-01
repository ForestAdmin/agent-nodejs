import type { AgentDataClient, AgentDataClientOptions } from './agent-data-client';
import type {
  CountRequestBody,
  ListRequestBody,
  RelationCountRequestBody,
  RelationListRequestBody,
} from './agent-query';
import type { AgentTransport } from '../agent/agent-transport';
import type { Logger } from '../ports/logger-port';
import type { CapabilitiesResult } from '../read-model/capabilities-cache';
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
  parseCountRequest,
  parseListRequest,
  parseRelationCountRequest,
  parseRelationListRequest,
} from './agent-query';
import { mapCountResponse, mapListResponse } from './response-mappers';
import {
  callAgent,
  decodeSegment,
  requireAgentToken,
  resolveReadModel,
} from '../http/agent-route-helpers';
import { unknownCollection, unknownRelation } from '../http/bff-local-errors';
import createAgentCapabilitiesFetcher from '../read-model/agent-capabilities-fetcher';
import {
  assertValidAgainstCapabilities,
  hasCapabilityConstrainedInput,
} from '../validation/capabilities-validator';
import assertNoRelationFieldPaths from '../validation/relation-field-guard';

const DATA_ROUTE = /^\/agent\/v1\/([^/]+)\/(list|count)$/;
const RELATION_ROUTE = /^\/agent\/v1\/([^/]+)\/relations\/([^/]+)\/(list|count)$/;

export interface DataRoutesMiddlewareOptions {
  store: ReadModelStore;
  transport: AgentTransport;
  logger: Logger;
  createClient?: (options: AgentDataClientOptions) => AgentDataClient;
}

interface RequestHandlerDeps {
  collection: string;
  client: AgentDataClient;
  store: ReadModelStore;
  transport: AgentTransport;
  token: string;
  timezone: string;
  logger: Logger;
}

type ListHandlerDeps = RequestHandlerDeps & { primaryKeys: PrimaryKeyField[] };

// The route's allow-list check ran against the read-model captured before this request awaited the
// capabilities; a refresh in that window can drop the collection, so it is re-checked against the
// generation the capabilities belong to. The agent stays the authority (it asserts canBrowse itself)
// — this keeps the BFF from serving a collection its own current schema no longer exposes.
function assertCollectionStillAllowed(readModel: ReadModel, collection: string): void {
  if (!readModel.isCollectionAllowed(collection)) throw unknownCollection();
}

function toValidationInput(body: ListRequestBody | RelationListRequestBody) {
  return {
    filter: body.filter,
    sortFields: body.sort?.map(clause => clause.field),
    projectionFields: body.projection,
  };
}

function resolveCapabilities(
  deps: RequestHandlerDeps,
  collection: string,
): Promise<{ capabilities: CapabilitiesResult; readModel: ReadModel }> {
  return callAgent(
    () =>
      deps.store.getCapabilities(
        collection,
        createAgentCapabilitiesFetcher({ transport: deps.transport, token: deps.token }),
      ),
    deps.logger,
  );
}

async function resolveCapabilitiesOrRethrowUnlessVanished(
  deps: RequestHandlerDeps,
  collection: string,
  assertStillExposed: (readModel: ReadModel) => void,
): Promise<{ capabilities: CapabilitiesResult; readModel: ReadModel }> {
  try {
    return await resolveCapabilities(deps, collection);
  } catch (error) {
    deps.logger('Warn', 'Capabilities lookup failed; re-checking exposure before rethrowing', {
      collection,
    });

    let readModel: ReadModel;

    try {
      readModel = await resolveReadModel(deps.store);
    } catch {
      throw error;
    }

    assertStillExposed(readModel);

    throw error;
  }
}

async function resolveOwnCapabilities(
  deps: RequestHandlerDeps,
): Promise<{ capabilities: CapabilitiesResult; readModel: ReadModel }> {
  const assertStillAllowed = (readModel: ReadModel) =>
    assertCollectionStillAllowed(readModel, deps.collection);

  const result = await resolveCapabilitiesOrRethrowUnlessVanished(
    deps,
    deps.collection,
    assertStillAllowed,
  );

  assertStillAllowed(result.readModel);

  return result;
}

async function handleList(ctx: Context, body: ListRequestBody, deps: ListHandlerDeps) {
  assertNoRelationFieldPaths(collectListFieldPaths(body));

  const validationInput = toValidationInput(body);

  // The store hands back the read-model the capabilities belong to; using it keeps the primary keys
  // serialized below from a different schema generation than the fields just validated, and re-checks
  // the allow-list in case that generation dropped the collection.
  let { primaryKeys } = deps;

  if (hasCapabilityConstrainedInput(validationInput)) {
    const { capabilities, readModel } = await resolveOwnCapabilities(deps);
    assertValidAgainstCapabilities(validationInput, capabilities);
    primaryKeys = readModel.getPrimaryKeys(deps.collection);
  }

  const query = buildListAgentQuery(deps.collection, deps.timezone, body);
  const records = await callAgent(() => deps.client.list(deps.collection, query), deps.logger);

  ctx.status = 200;
  ctx.body = mapListResponse(deps.collection, records, primaryKeys);
}

async function handleCount(ctx: Context, body: CountRequestBody, deps: RequestHandlerDeps) {
  assertNoRelationFieldPaths(collectCountFieldPaths(body));

  // Count carries only a filter (no sort/projection), so that is all there is to validate.
  if (body.filter !== undefined) {
    const { capabilities } = await resolveOwnCapabilities(deps);
    assertValidAgainstCapabilities({ filter: body.filter }, capabilities);
  }

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

function assertRelationStillExposed(readModel: ReadModel, deps: RelationHandlerDeps): void {
  assertCollectionStillAllowed(readModel, deps.collection);

  const stillTargets = readModel.getListableRelationTarget(deps.collection, deps.relation);

  if (stillTargets !== deps.foreignCollection) {
    throw unknownRelation(`Unknown relation: ${deps.collection}.${deps.relation}`);
  }

  assertCollectionStillAllowed(readModel, deps.foreignCollection);
}

async function resolveExposedRelationCapabilities(
  deps: RelationHandlerDeps,
): Promise<{ capabilities: CapabilitiesResult; readModel: ReadModel }> {
  const assertStillExposed = (readModel: ReadModel) => assertRelationStillExposed(readModel, deps);

  assertStillExposed(await resolveReadModel(deps.store));

  const result = await resolveCapabilitiesOrRethrowUnlessVanished(
    deps,
    deps.foreignCollection,
    assertStillExposed,
  );

  assertStillExposed(result.readModel);

  return result;
}

async function handleRelationList(
  ctx: Context,
  body: RelationListRequestBody,
  deps: RelationListHandlerDeps,
) {
  assertNoRelationFieldPaths(collectListFieldPaths(body));

  const validationInput = toValidationInput(body);

  let { primaryKeys } = deps;

  if (hasCapabilityConstrainedInput(validationInput)) {
    const { capabilities, readModel } = await resolveExposedRelationCapabilities(deps);
    assertValidAgainstCapabilities(validationInput, capabilities);
    primaryKeys = readModel.getPrimaryKeys(deps.foreignCollection);
  }

  const query = buildListAgentQuery(deps.foreignCollection, deps.timezone, body);
  const records = await callAgent(
    () => deps.client.listRelation(deps.collection, body.parentId, deps.relation, query),
    deps.logger,
  );

  ctx.status = 200;
  ctx.body = mapListResponse(deps.foreignCollection, records, primaryKeys);
}

async function handleRelationCount(
  ctx: Context,
  body: RelationCountRequestBody,
  deps: RelationHandlerDeps,
) {
  assertNoRelationFieldPaths(collectCountFieldPaths(body));

  if (body.filter !== undefined) {
    const { capabilities } = await resolveExposedRelationCapabilities(deps);
    assertValidAgainstCapabilities({ filter: body.filter }, capabilities);
  }

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
  const foreignCollection = readModel.getListableRelationTarget(deps.collection, relation);

  // TODO(PRD-672): the read-model's relation map is the allow-list, so an absent/to-one/polymorphic
  // relation cannot be told from a disallowed one — every non-listable relation maps to 404 here;
  // `relation_not_allowed` (403) has no local trigger, mirroring `collection_not_allowed`.
  if (!foreignCollection) {
    throw unknownRelation(`Unknown relation: ${deps.collection}.${relation}`);
  }

  // The agent checks browse permission on the foreign collection, but BFF exposure is a separate
  // allow-list: a browsable collection may still be hidden here. Mirror the parent allow-list check.
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
  transport,
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
    const token = requireAgentToken(ctx);
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
      client: createClient({ transport, token }),
      store,
      transport,
      token,
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
