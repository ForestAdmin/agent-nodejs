import type { AgentActionClient, AgentActionClientOptions } from './agent-action-client';
import type { Logger } from '../ports/logger-port';
import type ReadModelStore from '../read-model/read-model-store';
import type { Context, Middleware } from 'koa';

import {
  ActionFormValidationError,
  ActionRequiresApprovalError,
  UnknownActionFieldError,
} from '@forestadmin/agent-client';

import { mapActionExecuteResult } from './action-execute-mapper';
import { mapActionForm } from './action-form-mapper';
import defaultCreateAgentActionClient, { extractRawLayout } from './agent-action-client';
import { mapAgentError } from '../http/agent-error-mapper';
import {
  callAgent,
  decodeSegment,
  requireAgentToken,
  resolveReadModel,
} from '../http/agent-route-helpers';
import { actionRequiresApproval, invalidRequest, unknownAction } from '../http/bff-local-errors';

const ACTION_ROUTE = /^\/agent\/v1\/([^/]+)\/actions\/([^/]+)\/(form|execute)$/;

interface ActionRequestBody {
  recordIds?: unknown;
  values?: unknown;
}

// recordIds are opaque BFF ids; only presence and array-ness are checked. An empty array is allowed
// on purpose (global/bulk actions have no selected records); the spec AC only covers a missing
// recordIds, so `[]` is an explicit BFF choice, not a spec requirement.
// Ids are coerced to strings so a valid `0` (numeric primary key) survives agent-client's downstream
// `.filter(Boolean)`, which would otherwise drop it and load the form as if no record were selected.
function parseRecordIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    throw invalidRequest('recordIds is required and must be an array');
  }

  return raw.map(id => String(id));
}

function parseValues(raw: unknown): Record<string, unknown> {
  if (raw === undefined) return {};

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw invalidRequest('values must be an object');
  }

  return raw as Record<string, unknown>;
}

export interface ActionRoutesMiddlewareOptions {
  store: ReadModelStore;
  agentUrl: string;
  logger: Logger;
  createClient?: (options: AgentActionClientOptions) => AgentActionClient;
}

async function handleForm(
  ctx: Context,
  client: AgentActionClient,
  collection: string,
  actionName: string,
  recordIds: string[],
  values: Record<string, unknown>,
  logger: Logger,
): Promise<void> {
  // Each agent-hitting call is wrapped on its own; getFields/extractRawLayout/mapping stay outside
  // callAgent so a local BFF bug surfaces as a 500, not a mislabelled agent error. Fields and
  // layout are read AFTER tryToSetFields because a change hook rebuilds them in place.
  const action = await callAgent(
    () => client.loadAction(collection, actionName, recordIds),
    logger,
  );
  const skippedFields = await callAgent(() => action.tryToSetFields(values), logger);

  ctx.status = 200;
  ctx.body = mapActionForm(action, skippedFields, extractRawLayout(action));
}

async function handleExecute(
  ctx: Context,
  client: AgentActionClient,
  collection: string,
  actionName: string,
  recordIds: string[],
  values: Record<string, unknown>,
  logger: Logger,
): Promise<void> {
  const action = await callAgent(
    () => client.loadAction(collection, actionName, recordIds),
    logger,
  );

  // setFields is strict: an unknown submitted field is a client error (400), not a 500. A transport
  // failure from the change-hook it triggers is a genuine agent error, so it goes to the mapper.
  try {
    await action.setFields(values);
  } catch (error) {
    if (error instanceof UnknownActionFieldError) throw invalidRequest(error.message);
    throw mapAgentError(error, { logger });
  }

  // execute() cannot go through the generic callAgent: agent-client turns the native action Error
  // (HTTP 400) into ActionFormValidationError, a non-AgentHttpError the mapper would mislabel as a
  // transport 502. So the semantic outcomes are caught here, everything else falls to the mapper.
  let raw: unknown;

  try {
    raw = await action.execute();
  } catch (error) {
    if (error instanceof ActionRequiresApprovalError) {
      throw actionRequiresApproval(
        error.message,
        error.roleIdsAllowedToApprove !== undefined
          ? { roleIdsAllowedToApprove: error.roleIdsAllowedToApprove }
          : undefined,
      );
    }

    if (error instanceof ActionFormValidationError) {
      ctx.status = 400;
      ctx.body = { type: 'error', status: 400, message: error.message, html: error.html ?? null };

      return;
    }

    throw mapAgentError(error, { logger });
  }

  const { status, body } = mapActionExecuteResult(raw);
  ctx.status = status;
  ctx.body = body;
}

export default function createActionRoutesMiddleware({
  store,
  agentUrl,
  logger,
  createClient = defaultCreateAgentActionClient,
}: ActionRoutesMiddlewareOptions): Middleware {
  return async function actionRoutesMiddleware(ctx, next) {
    const match = ACTION_ROUTE.exec(ctx.path);

    if (!match || ctx.method !== 'POST') {
      await next();

      return;
    }

    const collection = decodeSegment(match[1], 'collection name');
    const actionName = decodeSegment(match[2], 'action name');
    const verb = match[3];
    const token = requireAgentToken(ctx);
    const readModel = await resolveReadModel(store);

    // The read-model's action map IS the allow-list, so an absent action cannot be told from a
    // known-but-disallowed one — every non-exposed action maps to 404 here; `action_not_allowed`
    // (403) has no local trigger, mirroring `collection_not_allowed`/`relation_not_allowed`. The
    // URL identity is resolved before the body, so a bad action 404s before its payload is read.
    // TODO(PRD-673): distinguish disallowed from unknown when a separate exposure source exists.
    if (!readModel.isActionAllowed(collection, actionName)) {
      throw unknownAction(`Unknown action: ${collection}.${actionName}`);
    }

    const body = (ctx.request.body ?? {}) as ActionRequestBody;
    const recordIds = parseRecordIds(body.recordIds);
    const values = parseValues(body.values);

    const client = createClient({
      agentUrl,
      token,
      actionEndpoints: readModel.getActionEndpoints(),
    });

    if (verb === 'execute') {
      await handleExecute(ctx, client, collection, actionName, recordIds, values, logger);
    } else {
      await handleForm(ctx, client, collection, actionName, recordIds, values, logger);
    }
  };
}
