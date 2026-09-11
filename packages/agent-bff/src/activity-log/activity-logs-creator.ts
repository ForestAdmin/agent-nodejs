import type ActivityLogDrainer from './activity-log-drainer';
import type { ActivityLogsWriter } from './activity-logs-service';
import type { Logger } from '../ports/logger-port';
import type {
  ActivityLogAction,
  ActivityLogResponse,
  ActivityLogType,
} from '@forestadmin/forestadmin-client';
import type { Context } from 'koa';

import { HttpError, NotFoundError } from '@forestadmin/forestadmin-client';

import { invalidateApiKeyIdentity } from '../api-key/api-key-middleware';
import {
  resolveForestServerToken,
  resolveRenderingId,
} from '../auth/forest-server-token-middleware';
import { sessionExpired } from '../http/bff-http-error';
import {
  AUDIT_RETRY_AFTER_SECONDS,
  auditNotAuthorized,
  auditUnavailable,
  isUnretryableAuditFailure,
} from '../http/bff-local-errors';

/** The actions the BFF writes: its data routes read, and its action route writes. */
export type BffActivityLogAction = Extract<
  ActivityLogAction,
  'index' | 'search' | 'filter' | 'listRelatedData' | 'action'
>;

/**
 * Fail policy for the audit trail, keyed by action type: a write whose activity log cannot be
 * created is blocked (no unaudited side effect), while a read proceeds with a warning (an audit
 * store outage must not take down the read surface).
 *
 * One case is arbitrated by the cause instead of the action type: an authorization refusal (403)
 * propagates for reads too — the read itself is not authorized either.
 */
const ACTION_TO_TYPE: Record<BffActivityLogAction, ActivityLogType> = {
  index: 'read',
  search: 'read',
  filter: 'read',
  listRelatedData: 'read',
  action: 'write',
};

const MAX_STATUS_ATTEMPTS = 5;
const STATUS_RETRY_DELAY_MS = 500;

const NO_RENDERING_MESSAGE = 'This request carries no usable rendering';

export interface ActivityLogContext {
  collectionName?: string;
  recordId?: string | number;
  recordIds?: string[] | number[];
  label?: string;
}

/**
 * The token that created the log is kept for the status transition: the transition is fired after
 * the response, when the session it came from may already be unreachable.
 */
export interface PendingActivityLog {
  activityLog: ActivityLogResponse;
  forestServerToken: string;
}

export interface CreatePendingActivityLogOptions {
  ctx: Context;
  service: ActivityLogsWriter;
  action: BffActivityLogAction;
  context?: ActivityLogContext;
  logger: Logger;
}

interface AuditCredentials {
  forestServerToken: string;
  renderingId: string;
}

function describeCause(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

const FORBIDDEN = 403;
const UNAUTHORIZED = 401;
const AUDIT_ENDPOINT_ABSENT_STATUSES = new Set([404, 501]);

const NO_AUDIT_ENDPOINT_MESSAGE =
  'The Forest server does not expose the endpoint the activity log is written through, so the ' +
  'operation was not performed';

/**
 * A 403 only. A 401 is not the caller being refused: the bearer the BFF audits with is minted by
 * the Forest server and cached, so a 401 says that token expired — answering the caller with
 * `audit_not_authorized` would refuse a read the fail-open policy lets through.
 */
function isAuthorizationRefusal(error: unknown): boolean {
  return error instanceof HttpError && error.status === FORBIDDEN;
}

function isExpiredAuditCredential(error: unknown): boolean {
  return error instanceof HttpError && error.status === UNAUTHORIZED;
}

/**
 * A Forest server that does not serve the activity-log endpoint at all, rather than one failing to
 * answer it. No retry can make the route appear, so the caller must not be handed a `Retry-After`
 * it would keep honouring on every write.
 */
function isAuditEndpointAbsent(error: unknown): boolean {
  return error instanceof HttpError && AUDIT_ENDPOINT_ABSENT_STATUSES.has(error.status);
}

/**
 * What locates the failure for support, and nothing else: the credential, the record ids and the
 * label are the payload this must never carry.
 */
function auditIdentifiers(
  ctx: Context,
  context?: ActivityLogContext,
): Record<string, string | number> {
  const renderingId = resolveRenderingId(ctx);

  return {
    ...(renderingId === undefined ? {} : { renderingId }),
    ...(context?.collectionName === undefined ? {} : { collectionName: context.collectionName }),
  };
}

/** An empty string is an answer, not a value: it locates no document, so it fails the guard. */
function isPresent(value: string | undefined | null): boolean {
  return value !== null && value !== undefined && value !== '';
}

/**
 * The status transition reads both the id and the index, so an answer carrying only an id strands
 * the entry `pending`: the fail-closed policy has to engage here, not asynchronously afterwards.
 */
function isTransitionable(activityLog: ActivityLogResponse): boolean {
  return isPresent(activityLog?.id) && isPresent(activityLog?.attributes?.index);
}

interface UnresolvedCredentialsReport {
  ctx: Context;
  action: BffActivityLogAction;
  context?: ActivityLogContext;
  logger: Logger;
  error: unknown;
}

/**
 * A credential this deployment never mints is a degradation the Forest server declares by sending
 * none (`api-key/api-key-client.ts`), so it warns; only a resolution that actually failed is an
 * error. The single report for either: `with-activity-log` states nothing of its own, which used to
 * double every line of the read path.
 */
function reportUnresolvedCredentials({
  ctx,
  action,
  context,
  logger,
  error,
}: UnresolvedCredentialsReport): void {
  const identifiers = { ...auditIdentifiers(ctx, context), cause: describeCause(error) };

  if (isUnretryableAuditFailure(error)) {
    logger(
      'Warn',
      `Activity log for '${action}' was not created: this deployment has no credential to write ` +
        'it with',
      identifiers,
    );

    return;
  }

  logger(
    'Error',
    `Activity log for '${action}' has no credentials to be created with`,
    identifiers,
  );
}

async function resolveCredentials(ctx: Context): Promise<AuditCredentials> {
  const renderingId = resolveRenderingId(ctx);

  if (renderingId === undefined) throw sessionExpired(NO_RENDERING_MESSAGE);

  return {
    forestServerToken: await resolveForestServerToken(ctx),
    renderingId: String(renderingId),
  };
}

export default async function createPendingActivityLog({
  ctx,
  service,
  action,
  context,
  logger,
}: CreatePendingActivityLogOptions): Promise<PendingActivityLog | null> {
  const type = ACTION_TO_TYPE[action];

  let credentials: AuditCredentials;

  try {
    credentials = await resolveCredentials(ctx);
  } catch (error) {
    reportUnresolvedCredentials({ ctx, action, context, logger, error });

    if (type === 'write') throw error;

    return null;
  }

  const { forestServerToken, renderingId } = credentials;

  let activityLog: ActivityLogResponse;

  try {
    activityLog = await service.createMcpActivityLog({
      forestServerToken,
      renderingId,
      action,
      type,
      collectionName: context?.collectionName,
      recordId: context?.recordId,
      recordIds: context?.recordIds,
      label: context?.label,
    });
  } catch (error) {
    logger('Error', `Activity log for '${action}' could not be created`, {
      ...auditIdentifiers(ctx, context),
      cause: describeCause(error),
    });

    if (isAuthorizationRefusal(error)) throw auditNotAuthorized();
    if (isExpiredAuditCredential(error)) invalidateApiKeyIdentity(ctx);

    if (type === 'write') {
      throw isAuditEndpointAbsent(error)
        ? auditUnavailable(undefined, NO_AUDIT_ENDPOINT_MESSAGE)
        : auditUnavailable(AUDIT_RETRY_AFTER_SECONDS);
    }

    return null;
  }

  if (!isTransitionable(activityLog)) {
    logger(
      'Error',
      `Activity log for '${action}' could not be created: the server answered with no activity ` +
        'log id or index, so the audit store dropped the write',
      auditIdentifiers(ctx, context),
    );

    if (type === 'write') throw auditUnavailable(AUDIT_RETRY_AFTER_SECONDS);

    return null;
  }

  return { activityLog, forestServerToken };
}

export interface MarkActivityLogOptions {
  service: ActivityLogsWriter;
  drainer: ActivityLogDrainer;
  pending: PendingActivityLog;
  status: 'completed' | 'failed';
  logger: Logger;
}

async function updateStatus(options: MarkActivityLogOptions, attempt = 1): Promise<void> {
  const { service, pending, status, logger } = options;

  try {
    await service.updateActivityLogStatus({
      forestServerToken: pending.forestServerToken,
      activityLog: pending.activityLog,
      status,
    });
  } catch (error) {
    // The document may not exist yet when the transition lands, and only then is a retry worth
    // anything: a network failure loses the transition permanently.
    if (error instanceof NotFoundError && attempt < MAX_STATUS_ATTEMPTS) {
      logger('Debug', `Activity log not found, retrying its status transition`, {
        attempt,
        attempts: MAX_STATUS_ATTEMPTS,
      });

      await new Promise<void>(resolve => {
        // Unreferenced: a pending retry must not outlive the shutdown grace the drainer enforces.
        setTimeout(resolve, STATUS_RETRY_DELAY_MS).unref();
      });

      await updateStatus(options, attempt + 1);

      return;
    }

    throw error;
  }
}

/**
 * Fire-and-forget on purpose: the caller's response must not wait for the audit store. The drainer
 * holds the promise so a shutdown can wait for it instead.
 */
export function markActivityLog(options: MarkActivityLogOptions): void {
  const { drainer, status, logger } = options;

  drainer
    .track(
      () => updateStatus(options),
      `'${status}' transition of the activity log ${options.pending.activityLog.id}`,
    )
    .catch(error => {
      logger('Error', `Failed to mark the activity log as '${status}'`, {
        activityLogId: options.pending.activityLog.id,
        index: options.pending.activityLog.attributes?.index,
        cause: describeCause(error),
      });
    });
}
