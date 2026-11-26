import type { Logger } from '../server';
import type { HttpError } from '@forestadmin/forestadmin-client';

import {
  ActionOutcomeUnknownError,
  ActivityLogBlockedError,
  AgentHttpError,
  AgentTimeoutError,
  classifyAgentError,
  extractErrorDetail,
} from '@forestadmin/agent-client';

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

const BLOCKED_OPERATION_MESSAGE =
  'The activity log could not be written, so the operation was not performed';

const DROPPED_AUDIT_MESSAGE =
  'Failed to create activity log: the server returned no activity log id. ' +
  'Blocking the operation to preserve the audit trail.';

const AGENT_TIMEOUT_MESSAGE = 'The agent did not answer in time.';

const AGENT_UNREACHABLE_MESSAGE = 'The agent could not be reached.';

const ACTION_OUTCOME_UNKNOWN_MESSAGE =
  'The action was sent but the agent gave no answer, so it may have run. Check whether it did ' +
  'before running it again.';

// A failure without an HTTP answer names the host and port it tried; the model gets the kind only.
function isUnanswered(error: unknown): error is Error {
  return !(error instanceof AgentHttpError) && classifyAgentError(error).kind === 'unreachable';
}

function messageOf(error: unknown): string {
  if (error instanceof ActionOutcomeUnknownError) return ACTION_OUTCOME_UNKNOWN_MESSAGE;

  if (isUnanswered(error)) {
    return error instanceof AgentTimeoutError ? AGENT_TIMEOUT_MESSAGE : AGENT_UNREACHABLE_MESSAGE;
  }

  return parseAgentError(error) || (error instanceof Error ? error.message : String(error));
}

export type ErrorEnhancer = (parsedMessage: string, originalError: unknown) => Promise<string>;

function blockedOperationError(error: ActivityLogBlockedError): unknown {
  if (error.reason === 'dropped') return new Error(DROPPED_AUDIT_MESSAGE);
  if (carriesTransportDetail(error.cause)) return new Error(AUDIT_UNAVAILABLE_MESSAGE);

  return new Error(`${BLOCKED_OPERATION_MESSAGE}: ${(error.cause as HttpError).message}`);
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

  if (isUnanswered(error)) logger('Warn', `Agent call failed without an answer: ${error.message}`);

  if (error instanceof AgentHttpError && error.status >= 500) {
    const detail = extractErrorDetail(error) ?? error.responseText;
    logger('Warn', `Agent answered HTTP ${error.status}: ${detail ?? 'no detail'}`);
  }

  let errorMessage = messageOf(error);

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
