import type { Logger } from '../server.js';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types';

import createPendingActivityLog, {
  ActivityLogAction,
  markActivityLogAsFailed,
  markActivityLogAsSucceeded,
} from './activity-logs-creator.js';
import parseAgentError from './error-parser.js';

interface ActivityLogContext {
  collectionName?: string;
  recordId?: string | number;
  recordIds?: string[] | number[];
  label?: string;
}

interface WithActivityLogOptions<T> {
  forestServerUrl: string;
  request: RequestHandlerExtra<ServerRequest, ServerNotification>;
  action: ActivityLogAction;
  context?: ActivityLogContext;
  logger: Logger;
  operation: () => Promise<T>;
}

/**
 * Wraps an operation with activity log lifecycle management.
 * Creates a pending activity log, executes the operation, and marks it as succeeded or failed.
 */
export default async function withActivityLog<T>(options: WithActivityLogOptions<T>): Promise<T> {
  const { forestServerUrl, request, action, context, logger, operation } = options;

  const activityLog = await createPendingActivityLog(forestServerUrl, request, action, context);

  try {
    const result = await operation();

    markActivityLogAsSucceeded({
      forestServerUrl,
      request,
      activityLog,
      logger,
    });

    return result;
  } catch (error) {
    const errorDetail = parseAgentError(error);
    const errorMessage = errorDetail || (error instanceof Error ? error.message : String(error));

    markActivityLogAsFailed({
      forestServerUrl,
      request,
      activityLog,
      errorMessage,
      logger,
    });

    throw errorDetail ? new Error(errorDetail) : error;
  }
}
