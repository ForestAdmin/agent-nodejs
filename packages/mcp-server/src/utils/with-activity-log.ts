import type { ActivityLogAction } from './activity-logs-creator';
import type { ForestServerClient } from '../http-client';
import type { Logger } from '../server';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types.js';

import createPendingActivityLog, {
  markActivityLogAsFailed,
  markActivityLogAsSucceeded,
} from './activity-logs-creator';
import parseAgentError from './error-parser';

interface ActivityLogContext {
  collectionName?: string;
  recordId?: string | number;
  recordIds?: string[] | number[];
  label?: string;
}

interface WithActivityLogOptions<T> {
  forestServerClient: ForestServerClient;
  request: RequestHandlerExtra<ServerRequest, ServerNotification>;
  action: ActivityLogAction;
  context?: ActivityLogContext;
  logger: Logger;
  operation: () => Promise<T>;
  /**
   * Optional function to enhance error messages before logging and throwing.
   * Receives the parsed error message and the original error.
   * Should return the enhanced error message to use.
   */
  errorEnhancer?: (parsedMessage: string, originalError: unknown) => Promise<string>;
}

/**
 * Wraps an operation with activity log lifecycle management.
 * Creates a pending activity log, executes the operation, and marks it as succeeded or failed.
 */
export default async function withActivityLog<T>(options: WithActivityLogOptions<T>): Promise<T> {
  const { forestServerClient, request, action, context, logger, operation, errorEnhancer } =
    options;

  // The activity log is created before the operation runs, so intent is captured even when the
  // operation itself fails. `createPendingActivityLog` owns the fail policy: it throws for a write
  // whose log could not be created (blocking the operation), and resolves to null for a read.
  const activityLog = await createPendingActivityLog(forestServerClient, request, action, context);

  // Read whose audit log could not be created (fail-open): proceed without status tracking.
  if (!activityLog) {
    logger(
      'Warn',
      `Activity log for '${action}' was not persisted by the server; ` +
        'proceeding without audit trail for this read operation.',
    );
  }

  try {
    const result = await operation();

    if (activityLog) {
      markActivityLogAsSucceeded({
        forestServerClient,
        request,
        activityLog,
        logger,
      });
    }

    return result;
  } catch (error) {
    const errorDetail = parseAgentError(error);
    let errorMessage = errorDetail || (error instanceof Error ? error.message : String(error));

    // Apply error enhancer if provided (e.g., to add helpful context about available fields)
    if (errorEnhancer) {
      try {
        errorMessage = await errorEnhancer(errorMessage, error);
      } catch (enhancerError) {
        logger(
          'Warn',
          `Error enhancement failed (using original error message): ${
            enhancerError instanceof Error ? enhancerError.message : String(enhancerError)
          }`,
        );
      }
    }

    if (activityLog) {
      markActivityLogAsFailed({
        forestServerClient,
        request,
        activityLog,
        logger,
      });
    }

    throw new Error(errorMessage);
  }
}
