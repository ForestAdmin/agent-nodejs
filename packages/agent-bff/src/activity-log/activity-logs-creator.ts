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

import {
  resolveForestServerToken,
  resolveRenderingId,
} from '../auth/forest-server-token-middleware';
import { sessionExpired } from '../http/bff-http-error';
import {
  AUDIT_RETRY_AFTER_SECONDS,
  auditNotAuthorized,
  auditUnavailable,
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
 * One case is arbitrated by the cause instead of the action type: an authorization refusal
 * (401/403) propagates for reads too — the read itself is not authorized either.
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

function isAuthorizationRefusal(error: unknown): boolean {
  return error instanceof HttpError && (error.status === 401 || error.status === 403);
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
    logger('Error', `Activity log for '${action}' has no credentials to be created with`, {
      cause: describeCause(error),
    });

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
      cause: describeCause(error),
    });

    if (isAuthorizationRefusal(error)) throw auditNotAuthorized();
    if (type === 'write') throw auditUnavailable(AUDIT_RETRY_AFTER_SECONDS);

    return null;
  }

  if (activityLog?.id === null || activityLog?.id === undefined) {
    if (type === 'write') throw auditUnavailable(AUDIT_RETRY_AFTER_SECONDS);

    logger(
      'Error',
      `Activity log for '${action}' could not be created: the server answered with no activity ` +
        'log id, so the audit store dropped the write',
    );

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
        setTimeout(resolve, STATUS_RETRY_DELAY_MS);
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
    .track(() => updateStatus(options))
    .catch(error => {
      logger('Error', `Failed to mark the activity log as '${status}'`, {
        cause: describeCause(error),
      });
    });
}
