import type {
  ActivityLogAction,
  ActivityLogResponse,
  ActivityLogType,
  ActivityLogWorkflow,
  ActivityLogsServiceInterface,
  CreateActivityLogParams,
} from '@forestadmin/forestadmin-client';

import { HttpError } from '@forestadmin/forestadmin-client';

import processDrainer from './activity-log-drainer';
import { isApprovalRequested } from '../approval-requested';
import {
  ActionRequiresApprovalError,
  ActivityLogBlockedError,
  ApprovalRequestCreationError,
} from '../errors';

export type ActivityLogLevel = 'Debug' | 'Info' | 'Warn' | 'Error';

export type ActivityLogLogger = (
  level: ActivityLogLevel,
  message: string,
  context?: Record<string, unknown>,
) => void;

export interface ActivityLogCredentials {
  forestServerToken: string;
  renderingId: string | number;
}

export interface ActivityLogContext {
  service: ActivityLogsServiceInterface;
  credentials: () => Promise<ActivityLogCredentials> | ActivityLogCredentials;
  logger?: ActivityLogLogger;
  workflow?: ActivityLogWorkflow;
  collectionIdOf?: (collectionName: string) => Promise<string>;
  retryCreation?: boolean;
  /**
   * For a consumer whose audit credential is minted and cached for it: a 401 then means that
   * credential expired, not that the caller is refused, so a read runs and the consumer is told to
   * drop what it cached. Without it a 401 refuses the read like a 403.
   */
  onExpiredCredential?: () => void;
}

export interface ActivityLogEntry {
  action: ActivityLogAction;
  collectionName?: string;
  recordIds?: (string | number)[];
  label?: string;
}

export interface ActivityLogCallOptions {
  action?: ActivityLogAction;
  label?: string;
  skip?: boolean;
  beforeCall?: () => Promise<void>;
}

export type DerivedActivityLogEntry = Omit<ActivityLogEntry, 'action'> & {
  action?: ActivityLogAction;
};

type ActivityLogStatus = 'completed' | 'failed' | 'canceled';

interface PendingActivityLog {
  activityLog: ActivityLogResponse;
  forestServerToken: string;
}

const ACTION_TYPES: Record<ActivityLogAction, ActivityLogType> = {
  index: 'read',
  search: 'read',
  filter: 'read',
  listRelatedData: 'read',
  describeCollection: 'read',
  action: 'write',
  create: 'write',
  update: 'write',
  delete: 'write',
  triggerWorkflow: 'write',
};

const FORBIDDEN = 403;
const UNAUTHORIZED = 401;
const SERVER_ERROR = 500;
/** Not found: the document may not be visible yet. 0: unreachable. 408: timeout. 429: throttled. */
const RETRYABLE_TRANSITION_STATUSES = new Set([0, 404, 408, 429]);
const ENDPOINT_ABSENT_STATUSES = new Set([404, 501]);
const MAX_STATUS_ATTEMPTS = 5;
const STATUS_RETRY_DELAY_MS = 500;
const CREATION_RETRY_DELAYS_MS = [100, 500, 2_000];
const RETRYABLE_CREATION_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

const silentLogger: ActivityLogLogger = () => {};

function describeCause(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

function hasHttpStatus(error: unknown, status: number): boolean {
  return error instanceof HttpError && error.status === status;
}

function isPresent(value: string | undefined | null): boolean {
  return value !== null && value !== undefined && value !== '';
}

/**
 * The status transition reads both the id and the index, so an answer carrying only one of them
 * strands the entry `pending`: the fail-closed policy has to engage here, not afterwards.
 */
function isTransitionable(activityLog: ActivityLogResponse): boolean {
  return isPresent(activityLog?.id) && isPresent(activityLog?.attributes?.index);
}

function wait(delayMs: number): Promise<void> {
  return new Promise<void>(resolve => {
    // Unreferenced: a pending retry must not outlive the shutdown grace the drain enforces.
    setTimeout(resolve, delayMs).unref();
  });
}

async function createWithRetry(
  context: ActivityLogContext,
  create: () => Promise<ActivityLogResponse>,
  attempt = 0,
): Promise<ActivityLogResponse> {
  try {
    return await create();
  } catch (error) {
    const { status } = (error ?? {}) as { status?: unknown };
    const retryable = typeof status === 'number' && RETRYABLE_CREATION_STATUSES.has(status);

    if (!context.retryCreation || !retryable || attempt >= CREATION_RETRY_DELAYS_MS.length) {
      throw error;
    }

    (context.logger ?? silentLogger)('Warn', 'Activity log creation failed, retrying it', {
      attempt: attempt + 1,
      httpStatus: status,
      cause: describeCause(error),
    });
    await wait(CREATION_RETRY_DELAYS_MS[attempt]);

    return createWithRetry(context, create, attempt + 1);
  }
}

async function writeActivityLog(
  context: ActivityLogContext,
  entry: ActivityLogEntry,
  credentials: ActivityLogCredentials,
  collectionId: string | undefined,
): Promise<ActivityLogResponse> {
  const params: CreateActivityLogParams = {
    forestServerToken: credentials.forestServerToken,
    renderingId: String(credentials.renderingId),
    action: entry.action,
    type: ACTION_TYPES[entry.action],
    recordIds: entry.recordIds?.map(String),
    label: entry.label,
  };

  if (context.collectionIdOf) {
    return createWithRetry(context, () =>
      context.service.createActivityLog({
        ...params,
        collectionName: collectionId,
        ...(context.workflow && { workflow: context.workflow }),
      }),
    );
  }

  return createWithRetry(context, () =>
    context.service.createMcpActivityLog({ ...params, collectionName: entry.collectionName }),
  );
}

async function createPendingActivityLog(
  context: ActivityLogContext,
  entry: ActivityLogEntry,
): Promise<PendingActivityLog | null> {
  const { action } = entry;
  const isWrite = ACTION_TYPES[action] === 'write';
  const logger = context.logger ?? silentLogger;
  const located: Record<string, unknown> = entry.collectionName
    ? { collectionName: entry.collectionName }
    : {};

  const collectionId =
    context.collectionIdOf && entry.collectionName
      ? await context.collectionIdOf(entry.collectionName)
      : undefined;

  let credentials: ActivityLogCredentials;

  try {
    credentials = await context.credentials();
  } catch (error) {
    logger('Error', `Activity log for '${action}' has no credentials to be created with`, {
      ...located,
      cause: describeCause(error),
    });

    if (isWrite) throw new ActivityLogBlockedError('unavailable', error);

    return null;
  }

  located.renderingId = credentials.renderingId;

  let activityLog: ActivityLogResponse;

  try {
    activityLog = await writeActivityLog(context, entry, credentials, collectionId);
  } catch (error) {
    logger('Error', `Activity log for '${action}' could not be created`, {
      ...located,
      cause: describeCause(error),
    });

    if (hasHttpStatus(error, FORBIDDEN)) throw new ActivityLogBlockedError('notAuthorized', error);

    if (hasHttpStatus(error, UNAUTHORIZED)) {
      if (!context.onExpiredCredential) throw new ActivityLogBlockedError('notAuthorized', error);
      context.onExpiredCredential();
    }

    if (!isWrite) return null;

    const isEndpointAbsent =
      error instanceof HttpError && ENDPOINT_ABSENT_STATUSES.has(error.status);

    throw new ActivityLogBlockedError(isEndpointAbsent ? 'endpointAbsent' : 'unavailable', error);
  }

  if (!isTransitionable(activityLog)) {
    logger(
      'Error',
      `Activity log for '${action}' could not be created: the server answered with no activity ` +
        'log id or index, so the audit store dropped the write',
      located,
    );

    if (isWrite) throw new ActivityLogBlockedError('dropped');

    return null;
  }

  return { activityLog, forestServerToken: credentials.forestServerToken };
}

/**
 * Retried are the failures a later attempt can land — the document not existing yet, a timeout, a
 * throttle, an unreachable server (status 0) and any 5xx — plus a transport failure rethrown raw,
 * which carries no status at all. A refusal or a malformed request is left to fail at once.
 */
function isRetryableTransitionFailure(error: unknown): boolean {
  if (!(error instanceof HttpError)) return true;

  return error.status >= SERVER_ERROR || RETRYABLE_TRANSITION_STATUSES.has(error.status);
}

async function updateStatus(
  context: ActivityLogContext,
  pending: PendingActivityLog,
  status: ActivityLogStatus,
  attempt = 1,
): Promise<void> {
  try {
    await context.service.updateActivityLogStatus({
      forestServerToken: pending.forestServerToken,
      activityLog: pending.activityLog,
      status,
    });
  } catch (error) {
    if (!isRetryableTransitionFailure(error) || attempt >= MAX_STATUS_ATTEMPTS) throw error;

    (context.logger ?? silentLogger)(
      'Debug',
      'Activity log status transition failed, retrying it',
      {
        attempt,
        attempts: MAX_STATUS_ATTEMPTS,
        cause: describeCause(error),
      },
    );
    await wait(STATUS_RETRY_DELAY_MS);
    await updateStatus(context, pending, status, attempt + 1);
  }
}

/** Fire-and-forget on purpose: the caller's answer must not wait for the audit store. */
function markActivityLog(
  context: ActivityLogContext,
  pending: PendingActivityLog,
  status: ActivityLogStatus,
): void {
  const { id, attributes } = pending.activityLog;

  processDrainer
    .track(
      () => updateStatus(context, pending, status),
      `'${status}' transition of the activity log ${id}`,
    )
    .catch(error => {
      (context.logger ?? silentLogger)('Error', `Failed to mark the activity log as '${status}'`, {
        activityLogId: id,
        index: attributes?.index,
        cause: describeCause(error),
      });
    });
}

function isApprovalOutcome(error: unknown): boolean {
  return (
    error instanceof ActionRequiresApprovalError || error instanceof ApprovalRequestCreationError
  );
}

async function runAudited<T>(
  context: ActivityLogContext,
  entry: ActivityLogEntry,
  operation: () => Promise<T>,
  beforeCall?: () => Promise<void>,
): Promise<T> {
  const pending = await createPendingActivityLog(context, entry);

  try {
    if (beforeCall) await beforeCall();
    const result = await operation();

    if (pending) {
      markActivityLog(context, pending, isApprovalRequested(result) ? 'canceled' : 'completed');
    }

    return result;
  } catch (error) {
    if (pending) {
      markActivityLog(context, pending, isApprovalOutcome(error) ? 'canceled' : 'failed');
    }

    throw error;
  }
}

function describeOperation({ action, collectionName }: ActivityLogEntry): string {
  return collectionName ? `'${action}' request on '${collectionName}'` : `'${action}' request`;
}

export default async function withActivityLog<T>(
  context: ActivityLogContext | undefined,
  entry: ActivityLogEntry | null,
  operation: () => Promise<T>,
  beforeCall?: () => Promise<void>,
): Promise<T> {
  if (!context || !entry) {
    if (beforeCall) await beforeCall();

    return operation();
  }

  return processDrainer.track(
    () => runAudited(context, entry, operation, beforeCall),
    describeOperation(entry),
  );
}

export function resolveEntry(
  derived: DerivedActivityLogEntry,
  call?: ActivityLogCallOptions,
): ActivityLogEntry | null {
  if (call?.skip) return null;

  const action = call?.action ?? derived.action;

  if (!action) return null;

  return { ...derived, action, label: call?.label ?? derived.label };
}

export function runCall<T>(
  context: ActivityLogContext | undefined,
  derived: DerivedActivityLogEntry,
  call: ActivityLogCallOptions | undefined,
  operation: () => Promise<T>,
): Promise<T> {
  return withActivityLog(context, resolveEntry(derived, call), operation, call?.beforeCall);
}

export function drainActivityLogs(timeoutMs?: number): Promise<string[]> {
  return processDrainer.drain(timeoutMs);
}
