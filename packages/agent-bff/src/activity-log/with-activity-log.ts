import type ActivityLogDrainer from './activity-log-drainer';
import type { ActivityLogContext, BffActivityLogAction } from './activity-logs-creator';
import type { ActivityLogsWriter } from './activity-logs-service';
import type { Logger } from '../ports/logger-port';
import type { Context } from 'koa';

import createPendingActivityLog, { markActivityLog } from './activity-logs-creator';

const COMPLETED = 'completed';
const FAILED = 'failed';

export interface WithActivityLogOptions<T> {
  ctx: Context;
  service: ActivityLogsWriter;
  drainer: ActivityLogDrainer;
  action: BffActivityLogAction;
  context?: ActivityLogContext;
  logger: Logger;
  operation: () => Promise<T>;
  /**
   * Errors the log records as `completed` rather than `failed` — the operation reached a business
   * outcome the BFF answers with an error status.
   */
  isCompletedDespite?: (error: unknown) => boolean;
}

/**
 * Runs an operation under an activity log: the pending log is awaited before the operation starts,
 * so nothing runs unaudited, and the status transition is fired without `await` afterwards.
 */
export default async function withActivityLog<T>(options: WithActivityLogOptions<T>): Promise<T> {
  const { ctx, service, drainer, action, context, logger, operation, isCompletedDespite } = options;

  const pending = await createPendingActivityLog({ ctx, service, action, context, logger });

  if (!pending) {
    logger(
      'Warn',
      `Activity log for '${action}' was not created; proceeding without an audit trail for this ` +
        'read operation',
    );
  }

  try {
    const result = await operation();

    if (pending) markActivityLog({ service, drainer, pending, status: COMPLETED, logger });

    return result;
  } catch (error) {
    if (pending) {
      const status = isCompletedDespite?.(error) ? COMPLETED : FAILED;
      markActivityLog({ service, drainer, pending, status, logger });
    }

    throw error;
  }
}
