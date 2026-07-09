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
  return new BffHttpError(400, 'invalid_request', message, details);
}

export function relationFieldNotSupported(
  message = 'Relation field is not supported',
): BffHttpError {
  return new BffHttpError(422, 'relation_field_not_supported', message);
}

export function mappingError(message = 'Failed to map the agent response'): BffHttpError {
  return new BffHttpError(500, 'mapping_error', message);
}

export function unsupportedActionResult(message = 'Unsupported action result'): BffHttpError {
  return new BffHttpError(501, 'unsupported_action_result', message);
}
