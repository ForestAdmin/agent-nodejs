import type { ActivityLogBlockedError } from '@forestadmin/agent-client';

import { BffHttpError, isSerializableError } from './bff-http-error';

export function unknownCollection(message = 'Unknown collection'): BffHttpError {
  return new BffHttpError(404, 'unknown_collection', message);
}

export function unknownRelation(message = 'Unknown relation'): BffHttpError {
  return new BffHttpError(404, 'unknown_relation', message);
}

export function unknownAction(message = 'Unknown action'): BffHttpError {
  return new BffHttpError(404, 'unknown_action', message);
}

export function collectionNotAllowed(message = 'Collection is not allowed'): BffHttpError {
  return new BffHttpError(403, 'collection_not_allowed', message);
}

export function relationNotAllowed(message = 'Relation is not allowed'): BffHttpError {
  return new BffHttpError(403, 'relation_not_allowed', message);
}

export function actionNotAllowed(message = 'Action is not allowed'): BffHttpError {
  return new BffHttpError(403, 'action_not_allowed', message);
}

const OUTCOME_UNKNOWN = 'unknown';

/**
 * The execute got no answer in time, and the agent may already have received it. Cutting the wait
 * cancels nothing: the action may have run and committed, so the caller is told to check before
 * retrying, which would otherwise apply it twice. Same status and type as any agent timeout, so a
 * client reading those keeps working; `details.outcome` is what tells this one apart.
 */
export function actionOutcomeUnknown(): BffHttpError {
  return new BffHttpError(
    504,
    'agent_timeout',
    'The agent did not respond in time. The action may still have run: check its outcome before retrying.',
    { details: { outcome: OUTCOME_UNKNOWN } },
  );
}

export function invalidRequest(message = 'Invalid request', details?: unknown): BffHttpError {
  return new BffHttpError(400, 'invalid_request', message, { details });
}

export function mappingError(message = 'Failed to map the agent response'): BffHttpError {
  return new BffHttpError(500, 'mapping_error', message);
}

export function schemaUnavailable(message = 'The agent schema is unavailable'): BffHttpError {
  return new BffHttpError(503, 'schema_unavailable', message);
}

export function unsupportedActionResult(message = 'Unsupported action result'): BffHttpError {
  return new BffHttpError(501, 'unsupported_action_result', message);
}

export function streamingUnsupported(
  message = 'Streaming is not supported over this transport',
): BffHttpError {
  return new BffHttpError(501, 'streaming_unsupported', message);
}

export function actionError(message = 'The action failed', details?: unknown): BffHttpError {
  return new BffHttpError(400, 'action_error', message, { details });
}

export function openapiDisabled(message = 'The OpenAPI document is not served'): BffHttpError {
  return new BffHttpError(404, 'openapi_disabled', message);
}

export function forestIdentityNotAllowed(message = 'Forest identity not allowed'): BffHttpError {
  return new BffHttpError(403, 'forest_identity_not_allowed', message);
}

export function oauthRequired(message = 'This route requires an OAuth session'): BffHttpError {
  return new BffHttpError(403, 'oauth_required', message);
}

const UPSTREAM_FALLBACK_STATUS = 502;

export function upstreamError(status: number): BffHttpError {
  const relayed = status >= 400 && status <= 599 ? status : UPSTREAM_FALLBACK_STATUS;

  return new BffHttpError(
    relayed,
    'upstream_error',
    'The Forest server failed to handle the request',
  );
}

export function upstreamUnreachable(): BffHttpError {
  return new BffHttpError(502, 'network_error', 'The Forest server could not be reached');
}

export function upstreamTimeout(): BffHttpError {
  return new BffHttpError(504, 'upstream_timeout', 'The Forest server did not respond in time');
}

// 500, never the provider's own status: the Zendesk app reads a 401 as an expired Forest session and
// a 502 as the Gateway being unreachable, neither of which a refused provider call is.
export function aiProviderError(): BffHttpError {
  return new BffHttpError(500, 'upstream_error', 'The AI provider failed to handle the request');
}

export function aiProviderTimeout(): BffHttpError {
  return new BffHttpError(504, 'upstream_timeout', 'The AI provider did not respond in time');
}

export function permissionsUnavailable(
  retryAfter: number,
  message = 'Permissions are unavailable',
): BffHttpError {
  return new BffHttpError(503, 'permissions_unavailable', message, { retryAfter });
}

export const RATE_LIMIT_CAUSES = {
  limitExceeded: 'limit_exceeded',
  limiterSaturated: 'limiter_saturated',
} as const;

export type RateLimitCause = (typeof RATE_LIMIT_CAUSES)[keyof typeof RATE_LIMIT_CAUSES];

export function tooManyRequests(
  retryAfter: number,
  message: string,
  cause: RateLimitCause,
): BffHttpError {
  return new BffHttpError(429, 'too_many_requests', message, {
    details: { cause },
    retryAfter,
  });
}

export function approvalRequestFailed(
  message = 'The action requires an approval, and the approval request could not be filed, so the action was not run',
): BffHttpError {
  return new BffHttpError(503, 'approval_request_failed', message);
}

export const AUDIT_RETRY_AFTER_SECONDS = 5;

export const AUDIT_UNAVAILABLE_TYPE = 'audit_unavailable';

/**
 * `retryAfter` is optional: a retry only helps while the audit store is expected to answer soon.
 * A deployment whose Forest server cannot write the log at all must not advertise one.
 */
export function auditUnavailable(
  retryAfter?: number,
  message = 'The activity log could not be written, so the operation was not performed',
): BffHttpError {
  return new BffHttpError(503, AUDIT_UNAVAILABLE_TYPE, message, { retryAfter });
}

export function auditNotAuthorized(
  message = 'Not authorized to write the activity log for this request',
): BffHttpError {
  return new BffHttpError(403, 'audit_not_authorized', message);
}

const NO_AUDIT_ENDPOINT_MESSAGE =
  'The Forest server does not expose the endpoint the activity log is written through, so the ' +
  'operation was not performed';

/**
 * A credential this edge failed to resolve is already one of its own answers — an expired session,
 * a plan lacking the feature, a deployment minting no audit token — so it is answered as is.
 */
export function auditErrorOf(error: ActivityLogBlockedError): unknown {
  if (error.reason === 'notAuthorized') return auditNotAuthorized();
  if (isSerializableError(error.cause)) return error.cause;

  if (error.reason === 'endpointAbsent') {
    return auditUnavailable(undefined, NO_AUDIT_ENDPOINT_MESSAGE);
  }

  return auditUnavailable(AUDIT_RETRY_AFTER_SECONDS);
}

export function environmentUnresolved(): BffHttpError {
  return new BffHttpError(
    502,
    'environment_unresolved',
    'The Forest environment could not be resolved',
  );
}
