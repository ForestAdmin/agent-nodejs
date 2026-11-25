import type { ActivityLogContext, ActivityLogStatus, PendingActivityLog } from './types';

import { HttpError } from '@forestadmin/forestadmin-client';

import processDrainer from './activity-log-drainer';
import { describeCause, silentLogger, wait } from './shared';

const SERVER_ERROR = 500;
/** Not found: the document may not be visible yet. 0: unreachable. 408: timeout. 429: throttled. */
const RETRYABLE_TRANSITION_STATUSES = new Set([0, 404, 408, 429]);
const MAX_STATUS_ATTEMPTS = 5;
const STATUS_RETRY_DELAY_MS = 500;

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
export default function markActivityLog(
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
