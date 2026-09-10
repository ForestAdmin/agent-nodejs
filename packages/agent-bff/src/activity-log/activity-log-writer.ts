import type { ActivityLogContext, BffActivityLogAction } from './activity-logs-creator';
import type { ActivityLogsWriter } from './activity-logs-service';
import type { Logger } from '../ports/logger-port';
import type { Context } from 'koa';

import ActivityLogDrainer from './activity-log-drainer';
import withActivityLog from './with-activity-log';

export interface RecordActivityLogOptions<T> {
  ctx: Context;
  action: BffActivityLogAction;
  context?: ActivityLogContext;
  operation: () => Promise<T>;
  isCompletedDespite?: (error: unknown) => boolean;
}

export interface ActivityLogWriter {
  record<T>(options: RecordActivityLogOptions<T>): Promise<T>;
  /**
   * Waits for the audited requests still running and for the status transitions no connection
   * holds. Called when the server stops.
   */
  drain(): Promise<void>;
}

export interface ActivityLogWriterOptions {
  service: ActivityLogsWriter;
  logger: Logger;
}

export default function createActivityLogWriter({
  service,
  logger,
}: ActivityLogWriterOptions): ActivityLogWriter {
  const drainer = new ActivityLogDrainer();

  return {
    record<T>(options: RecordActivityLogOptions<T>): Promise<T> {
      return drainer.track(() => withActivityLog({ ...options, service, drainer, logger }));
    },

    drain(): Promise<void> {
      return drainer.drain();
    },
  };
}
