import type { ActivityLogAction } from './activity-logs-creator';
import type { McpHttpClient } from '../http-client';
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
  httpClient: McpHttpClient;
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
  const { httpClient, request, action, context, logger, operation, errorEnhancer } = options;

  // We want to create the activity log before executing the operation
  // If activity log creation fails, we must prevent the execution of the operation
  const activityLog = await createPendingActivityLog(httpClient, request, action, context);

  try {
    const result = await operation();

    markActivityLogAsSucceeded({
      httpClient,
      request,
      activityLog,
      logger,
    });

    return result;
  } catch (error) {
    const errorDetail = parseAgentError(error);
    let errorMessage = errorDetail || (error instanceof Error ? error.message : String(error));

    // Apply error enhancer if provided (e.g., to add helpful context about available fields)
    if (errorEnhancer) {
      try {
        errorMessage = await errorEnhancer(errorMessage, error);
      } catch {
        // If enhancement fails, use the original parsed message
      }
    }

    markActivityLogAsFailed({
      httpClient,
      request,
      activityLog,
      errorMessage,
      logger,
    });

    throw new Error(errorMessage);
  }
}
