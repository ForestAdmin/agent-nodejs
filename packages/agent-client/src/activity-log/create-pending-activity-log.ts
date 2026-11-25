import type {
  ActivityLogContext,
  ActivityLogCredentials,
  ActivityLogEntry,
  ActivityLogLogger,
  PendingActivityLog,
} from './types';
import type {
  ActivityLogAction,
  ActivityLogResponse,
  ActivityLogType,
  CreateActivityLogParams,
} from '@forestadmin/forestadmin-client';

import { HttpError } from '@forestadmin/forestadmin-client';

import { describeCause, silentLogger, wait } from './shared';
import { ActivityLogBlockedError } from '../errors';

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
  createApproval: 'write',
};

const FORBIDDEN = 403;
const UNAUTHORIZED = 401;
const ENDPOINT_ABSENT_STATUSES = new Set([404, 501]);
const CREATION_RETRY_DELAYS_MS = [100, 500, 2_000];
const RETRYABLE_CREATION_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

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

function logUnauditedOperation(
  logger: ActivityLogLogger,
  isWrite: boolean,
  failure: string,
  context: Record<string, unknown>,
): void {
  if (isWrite) logger('Error', `${failure}, so the write was not performed`, context);
  else logger('Warn', `${failure}, so the read ran without it`, context);
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
    const collectionId = entry.collectionName
      ? await context.collectionIdOf(entry.collectionName)
      : undefined;

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

export default async function createPendingActivityLog(
  context: ActivityLogContext,
  entry: ActivityLogEntry,
): Promise<PendingActivityLog | null> {
  const { action } = entry;
  const isWrite = ACTION_TYPES[action] === 'write';
  const logger = context.logger ?? silentLogger;
  const located: Record<string, unknown> = entry.collectionName
    ? { collectionName: entry.collectionName }
    : {};

  let credentials: ActivityLogCredentials;

  try {
    credentials = await context.credentials();
  } catch (error) {
    logUnauditedOperation(
      logger,
      isWrite,
      `Activity log for '${action}' has no credentials to be created with`,
      { ...located, cause: describeCause(error) },
    );

    if (isWrite) throw new ActivityLogBlockedError('unavailable', error);

    return null;
  }

  located.renderingId = credentials.renderingId;

  let activityLog: ActivityLogResponse;

  try {
    activityLog = await writeActivityLog(context, entry, credentials);
  } catch (error) {
    const failure = `Activity log for '${action}' could not be created`;
    const failureContext = { ...located, cause: describeCause(error) };
    const isRefused =
      hasHttpStatus(error, FORBIDDEN) ||
      (hasHttpStatus(error, UNAUTHORIZED) && !context.onExpiredCredential);

    if (isRefused) logger('Error', failure, failureContext);
    else logUnauditedOperation(logger, isWrite, failure, failureContext);

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
    logUnauditedOperation(
      logger,
      isWrite,
      `Activity log for '${action}' could not be created: the server answered with no activity ` +
        'log id or index',
      located,
    );

    if (isWrite) throw new ActivityLogBlockedError('dropped');

    return null;
  }

  return { activityLog, forestServerToken: credentials.forestServerToken };
}
