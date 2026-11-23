import type { Logger } from '../server';

import { ActivityLogBlockedError } from '@forestadmin/agent-client';

import parseAgentError from './error-parser';
import { carriesTransportDetail } from './workflow-error';

/**
 * Sent instead of the cause when a write is blocked by an audit failure whose message carries
 * transport detail. Retrying is safe advice here, unlike a failure of the operation itself: the
 * operation was refused before it ran, so nothing has happened yet.
 */
export const AUDIT_UNAVAILABLE_MESSAGE =
  'Forest could not be reached to write the audit trail, so the operation was not performed. ' +
  'This is a temporary server-side failure — retry later, and report it to your Forest ' +
  'administrator if it persists.';

const DROPPED_AUDIT_MESSAGE =
  'Failed to create activity log: the server returned no activity log id. ' +
  'Blocking the operation to preserve the audit trail.';

export type ErrorEnhancer = (parsedMessage: string, originalError: unknown) => Promise<string>;

function blockedOperationError(error: ActivityLogBlockedError): unknown {
  if (error.reason === 'dropped') return new Error(DROPPED_AUDIT_MESSAGE);
  if (carriesTransportDetail(error.cause)) return new Error(AUDIT_UNAVAILABLE_MESSAGE);

  return error.cause;
}

/**
 * The caller is a model: an agent error is reduced to its readable detail, and an audit failure
 * never carries the Forest server URL, an internal host:port or a TLS chain into its context.
 */
export default async function toToolError(
  error: unknown,
  { logger, errorEnhancer }: { logger: Logger; errorEnhancer?: ErrorEnhancer },
): Promise<unknown> {
  if (error instanceof ActivityLogBlockedError) return blockedOperationError(error);

  const errorDetail = parseAgentError(error);
  let errorMessage = errorDetail || (error instanceof Error ? error.message : String(error));

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

  return new Error(errorMessage);
}
