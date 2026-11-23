import { BffHttpError } from '../../src/http/bff-http-error';
import {
  actionNotAllowed,
  actionOutcomeUnknown,
  auditNotAuthorized,
  auditUnavailable,
  collectionNotAllowed,
  invalidRequest,
  isActionOutcomeUnknown,
  mappingError,
  openapiDisabled,
  relationNotAllowed,
  schemaUnavailable,
  streamingUnsupported,
  unknownAction,
  unknownCollection,
  unknownRelation,
  unsupportedActionResult,
} from '../../src/http/bff-local-errors';

describe('bff local errors', () => {
  it.each([
    [unknownCollection, 'unknown_collection', 404],
    [unknownRelation, 'unknown_relation', 404],
    [unknownAction, 'unknown_action', 404],
    [collectionNotAllowed, 'collection_not_allowed', 403],
    [relationNotAllowed, 'relation_not_allowed', 403],
    [actionNotAllowed, 'action_not_allowed', 403],
    [invalidRequest, 'invalid_request', 400],
    [mappingError, 'mapping_error', 500],
    [schemaUnavailable, 'schema_unavailable', 503],
    [unsupportedActionResult, 'unsupported_action_result', 501],
    [openapiDisabled, 'openapi_disabled', 404],
    [streamingUnsupported, 'streaming_unsupported', 501],
    [auditNotAuthorized, 'audit_not_authorized', 403],
  ])('%p builds a %s error with status %d', (factory, type, status) => {
    expect(factory()).toMatchObject({ type, status });
  });

  it('carries the retry delay on auditUnavailable', () => {
    expect(auditUnavailable(5)).toMatchObject({
      type: 'audit_unavailable',
      status: 503,
      retryAfter: 5,
    });
  });

  it('recognizes the execute timeout it built as an unknown outcome', () => {
    expect(isActionOutcomeUnknown(actionOutcomeUnknown())).toBe(true);
  });

  it('does not take an agent error carrying outcome unknown in its details for one', () => {
    const agentError = new BffHttpError(403, 'forbidden', 'Denied', {
      details: { outcome: 'unknown' },
    });

    expect(isActionOutcomeUnknown(agentError)).toBe(false);
  });

  it('carries details on invalidRequest', () => {
    expect(invalidRequest('bad', { field: 'x' })).toMatchObject({
      type: 'invalid_request',
      status: 400,
      details: { field: 'x' },
    });
  });
});
