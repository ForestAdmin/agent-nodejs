import { BffHttpError } from './bff-http-error';

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

export const ACTION_REQUIRES_APPROVAL_TYPE = 'action_requires_approval';

export function actionRequiresApproval(
  message = 'This action requires an approval before it can run',
  details?: unknown,
): BffHttpError {
  return new BffHttpError(403, ACTION_REQUIRES_APPROVAL_TYPE, message, { details });
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

/**
 * The audit trail cannot be written in this deployment at all — no credential minted, no endpoint
 * exposed — as opposed to an outage that a retry outlives. The missing `retryAfter` is the marker:
 * it is what the callers above use to say a retry can never succeed.
 */
export function isUnretryableAuditFailure(error: unknown): boolean {
  return (
    error instanceof BffHttpError &&
    error.type === AUDIT_UNAVAILABLE_TYPE &&
    error.retryAfter === undefined
  );
}

export function auditNotAuthorized(
  message = 'Not authorized to write the activity log for this request',
): BffHttpError {
  return new BffHttpError(403, 'audit_not_authorized', message);
}

export function environmentUnresolved(): BffHttpError {
  return new BffHttpError(
    502,
    'environment_unresolved',
    'The Forest environment could not be resolved',
  );
}
