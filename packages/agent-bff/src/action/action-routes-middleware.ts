import type {
  Action,
  ActionForm,
  AgentActionClient,
  AgentActionClientOptions,
} from './agent-action-client';
import type { AgentTransport } from '../agent/agent-transport';
import type { Logger } from '../ports/logger-port';
import type ReadModelStore from '../read-model/read-model-store';
import type { Context, Middleware } from 'koa';

import {
  ActionFormValidationError,
  ActionOutcomeUnknownError,
  ActionValuesNotExecutableError,
  ActivityLogBlockedError,
  ApprovalRequestCreationError,
  InvalidActionFileValueError,
  UnknownActionFieldError,
  isApprovalRequested,
} from '@forestadmin/agent-client';

import { mapActionExecuteResult } from './action-execute-mapper';
import { mapActionForm } from './action-form-mapper';
import { actionValuesError, logEnumValuesWithoutOptions } from './action-values-validator';
import defaultCreateAgentActionClient, { extractRawLayout } from './agent-action-client';
import sanitizeActionHtml from './sanitize-action-html';
import activityLogConfigOf from '../auth/activity-log-context';
import { mapAgentError } from '../http/agent-error-mapper';
import {
  callAgent,
  decodeSegment,
  requireAgentToken,
  resolveReadModel,
} from '../http/agent-route-helpers';
import { BffHttpError } from '../http/bff-http-error';
import {
  actionError,
  actionOutcomeUnknown,
  approvalRequestFailed,
  invalidRequest,
  unknownAction,
} from '../http/bff-local-errors';

const ACTION_ROUTE = /^\/agent\/v1\/([^/]+)\/actions\/([^/]+)\/(form|execute)$/;

const EXECUTE_VERB = 'execute';

interface ActionRequestBody {
  recordIds?: unknown;
  values?: unknown;
  approvalRequestMessage?: unknown;
}

// recordIds are opaque BFF ids; only presence and array-ness are checked. An empty array is allowed
// on purpose (global/bulk actions have no selected records); the spec AC only covers a missing
// recordIds, so `[]` is an explicit BFF choice, not a spec requirement.
function parseRecordIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    throw invalidRequest('recordIds is required and must be an array');
  }

  return raw.map(id => String(id));
}

const ACTION_BODY_KEYS = ['recordIds', 'values', 'timezone', 'approvalRequestMessage'];

// The body is closed like the data bodies are: a misspelled `values` used to execute the action
// with no value at all, and answer 200 as if every field had been filled.
function assertKnownBodyKeys(body: Record<string, unknown>): void {
  const stray = Object.keys(body).find(key => !ACTION_BODY_KEYS.includes(key));

  if (stray !== undefined) {
    throw invalidRequest(`Request body cannot carry "${stray}"`);
  }
}

function parseValues(raw: unknown): Record<string, unknown> {
  if (raw === undefined) return {};

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw invalidRequest('values must be an object');
  }

  return raw as Record<string, unknown>;
}

function parseApprovalRequestMessage(raw: unknown): string | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw === 'string') return raw;

  throw invalidRequest('approvalRequestMessage must be a string');
}

// Only plain objects are enumerated: a File result arrives as a Buffer/stream whose every byte
// index is an enumerable key, so `Object.keys` on it would build a multi-million entry log.
function describePayloadShape(raw: unknown): string {
  if (raw === null) return 'null';
  if (typeof raw !== 'object') return typeof raw;
  if (Buffer.isBuffer(raw)) return `Buffer(${raw.length})`;
  if (ArrayBuffer.isView(raw)) return `${raw.constructor.name}(${raw.byteLength})`;
  if (Array.isArray(raw)) return `array(${raw.length})`;
  if (Object.getPrototypeOf(raw) !== Object.prototype) return raw.constructor?.name ?? 'object';

  return `object{${Object.keys(raw).join(',')}}`;
}

export interface ActionRoutesMiddlewareOptions {
  store: ReadModelStore;
  transport: AgentTransport;
  logger: Logger;
  forestServerUrl: string;
  createClient?: (options: AgentActionClientOptions) => AgentActionClient;
  /** Bounds the execute call alone; the transport's own timeout applies when omitted. */
  actionTimeoutMs?: number;
}

interface FormHandlerArgs {
  ctx: Context;
  action: ActionForm;
  values: Record<string, unknown>;
  logger: Logger;
}

async function handleForm({ ctx, action, values, logger }: FormHandlerArgs): Promise<void> {
  // Each agent-hitting call is wrapped on its own; getFields/extractRawLayout/mapping stay outside
  // callAgent so a local BFF bug surfaces as a 500, not a mislabelled agent error. Fields and
  // layout are read AFTER tryToSetFields because a change hook rebuilds them in place.
  const skippedFields = await callAgent(() => action.tryToSetFields(values), logger);

  ctx.status = 200;
  ctx.body = mapActionForm(action, skippedFields, extractRawLayout(action), logger);
}

async function fillValues(
  action: Action,
  values: Record<string, unknown>,
  logger: Logger,
): Promise<void> {
  try {
    await action.setFields(values);
  } catch (error) {
    if (error instanceof UnknownActionFieldError || error instanceof InvalidActionFileValueError) {
      throw invalidRequest(error.message);
    }

    throw mapAgentError(error, { logger });
  }

  logEnumValuesWithoutOptions(action, logger);
}

// execute() cannot go through the generic callAgent: agent-client turns the native action Error
// (HTTP 400) into ActionFormValidationError, a non-AgentHttpError the mapper would mislabel as a
// transport 502. So the semantic outcomes are caught here, everything else falls to the mapper.
function toExecuteError(error: unknown, logger: Logger): unknown {
  if (error instanceof BffHttpError || error instanceof ActivityLogBlockedError) return error;

  if (error instanceof ApprovalRequestCreationError) {
    logger('Error', 'The approval request of an action could not be filed', {
      cause: error.cause instanceof Error ? error.cause.message : String(error.cause),
    });

    return approvalRequestFailed();
  }

  if (error instanceof ActionValuesNotExecutableError) return actionValuesError(error, logger);

  if (error instanceof ActionFormValidationError) {
    const { unstructuredCause } = error;

    if (unstructuredCause) {
      logger('Warn', 'Agent action 4xx carried no structured error; client message is generic', {
        httpStatus: unstructuredCause.status,
        cause: unstructuredCause.responseText ?? unstructuredCause.body,
      });
    }

    const html = sanitizeActionHtml(error.html, logger);

    return actionError(error.message, html === null ? undefined : { html });
  }

  return mapAgentError(error, { logger });
}

interface ExecuteHandlerArgs {
  ctx: Context;
  client: AgentActionClient;
  params: {
    collection: string;
    actionName: string;
    recordIds: string[];
    timezone: string;
    approvalRequestMessage?: string;
  };
  refusal?: () => never;
  values: Record<string, unknown>;
  logger: Logger;
  actionTimeoutMs?: number;
}

async function handleExecute({
  ctx,
  client,
  params,
  refusal,
  values,
  logger,
  actionTimeoutMs,
}: ExecuteHandlerArgs): Promise<void> {
  let raw: unknown;

  try {
    raw = await client.executeAction({
      ...params,
      maxTimeAllowed: actionTimeoutMs,
      beforeCall: async () => refusal?.(),
      fill: action => fillValues(action, values, logger),
    });
  } catch (error) {
    if (error instanceof ActionOutcomeUnknownError) {
      const { collection, actionName, recordIds } = params;
      logger('Warn', 'Action execute got no answer: outcome unknown', {
        collection,
        actionName,
        recordIds,
        cause: error.cause instanceof Error ? error.cause.message : String(error.cause),
      });

      throw actionOutcomeUnknown();
    }

    throw toExecuteError(error, logger);
  }

  if (isApprovalRequested(raw) && !raw.approvalRequest) {
    logger('Error', 'The Forest server filed an approval request but returned no id for it');

    throw approvalRequestFailed(
      'The approval request was filed, but the Forest server returned no id for it, so the ' +
        'action was not run. Retrying would file a second request.',
    );
  }

  const { status, body } = mapActionExecuteResult(raw, logger);

  // An unrecognized payload (a File stream, or a new agent result type) maps to a generic 501 with
  // no trace of what it was; log a short shape hint so the case can be diagnosed without the body.
  if (status === 501) {
    logger('Warn', 'Unrecognized action execute result mapped to 501', {
      shape: describePayloadShape(raw),
    });
  }

  ctx.status = status;
  ctx.body = body;
}

export default function createActionRoutesMiddleware({
  store,
  transport,
  logger,
  forestServerUrl,
  createClient = defaultCreateAgentActionClient,
  actionTimeoutMs,
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
    // (403) has no local trigger, mirroring `collection_not_allowed`/`relation_not_allowed`.
    // TODO(PRD-673): distinguish disallowed from unknown when a separate exposure source exists.
    const allowed = readModel.isActionAllowed(collection, actionName);

    const refuseUnknownAction = (): never => {
      throw unknownAction(`Unknown action: ${collection}.${actionName}`);
    };

    // The form is unaudited, so it keeps refusing before the body is read.
    if (!allowed && verb !== EXECUTE_VERB) refuseUnknownAction();

    const body = (ctx.request.body ?? {}) as ActionRequestBody;
    assertKnownBodyKeys(body as Record<string, unknown>);
    const recordIds = parseRecordIds(body.recordIds);
    const values = parseValues(body.values);
    const approvalRequestMessage = parseApprovalRequestMessage(body.approvalRequestMessage);

    const client = createClient({
      transport,
      token,
      schema: readModel.getSchema(),
      activityLog:
        verb === EXECUTE_VERB ? activityLogConfigOf(ctx, forestServerUrl, logger) : undefined,
    });

    const params = { collection, actionName, recordIds, timezone: ctx.state.timezone as string };

    // The form is not audited, mirroring mcp-server, whose get-action-form tool writes no log
    // either: the record-touching event the trail records is the execution.
    if (verb !== EXECUTE_VERB) {
      const action = await callAgent(() => client.loadAction(params), logger);

      await handleForm({ ctx, action, values, logger });

      return;
    }

    // The whole sequence is audited, loading the action and setting its values included, so the
    // intent is recorded even when the attempt never reaches the agent's execute. The allow-list
    // refusal is inside too, mirroring mcp-server, whose execute-action tool resolves the action
    // within its own entry: an attempt on an action the caller may not trigger is exactly what the
    // trail is for, and the record ids it names are only known once the body is read.
    await handleExecute({
      ctx,
      client,
      params: { ...params, approvalRequestMessage },
      refusal: allowed ? undefined : refuseUnknownAction,
      values,
      logger,
      actionTimeoutMs,
    });
  };
}
