import {
  actionNotAllowed,
  collectionNotAllowed,
  invalidRequest,
  mappingError,
  relationFieldNotSupported,
  relationNotAllowed,
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
    [relationFieldNotSupported, 'relation_field_not_supported', 422],
    [mappingError, 'mapping_error', 500],
    [unsupportedActionResult, 'unsupported_action_result', 501],
  ])('%p builds a %s error with status %d', (factory, type, status) => {
    expect(factory()).toMatchObject({ type, status });
  });

  it('carries details on invalidRequest', () => {
    expect(invalidRequest('bad', { field: 'x' })).toMatchObject({
      type: 'invalid_request',
      status: 400,
      details: { field: 'x' },
    });
  });
});
