import { ActivityLogBlockedError } from '@forestadmin/agent-client';

import {
  actionNotAllowed,
  auditErrorOf,
  auditNotAuthorized,
  auditUnavailable,
  collectionNotAllowed,
  invalidRequest,
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
import { planFeatureMissing } from '../../src/oauth/oauth-error';

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

  it('carries details on invalidRequest', () => {
    expect(invalidRequest('bad', { field: 'x' })).toMatchObject({
      type: 'invalid_request',
      status: 400,
      details: { field: 'x' },
    });
  });
});

describe('auditErrorOf', () => {
  it('should answer audit_not_authorized when the audit store refused the identity', () => {
    expect(auditErrorOf(new ActivityLogBlockedError('notAuthorized'))).toMatchObject({
      status: 403,
      type: 'audit_not_authorized',
    });
  });

  it('should answer the error the edge raised while resolving its credential', () => {
    const refusal = planFeatureMissing();

    expect(auditErrorOf(new ActivityLogBlockedError('unavailable', refusal))).toBe(refusal);
  });

  it('should answer audit_unavailable without a retry hint when the endpoint is absent', () => {
    expect(auditErrorOf(new ActivityLogBlockedError('endpointAbsent'))).toMatchObject({
      status: 503,
      type: 'audit_unavailable',
      retryAfter: undefined,
      message:
        'The Forest server does not expose the endpoint the activity log is written through, so ' +
        'the operation was not performed',
    });
  });

  it.each(['unavailable', 'dropped'] as const)(
    'should answer audit_unavailable with a retry hint when the log was %s',
    reason => {
      expect(auditErrorOf(new ActivityLogBlockedError(reason, new Error('down')))).toMatchObject({
        status: 503,
        type: 'audit_unavailable',
        retryAfter: 5,
      });
    },
  );
});
