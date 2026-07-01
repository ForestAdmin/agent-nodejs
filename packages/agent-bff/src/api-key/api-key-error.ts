export type ApiKeyErrorType =
  | 'invalid_api_key'
  | 'forest_identity_not_allowed'
  | 'invalid_request'
  | 'key_resolution_unavailable';

export class ApiKeyError extends Error {
  readonly status: number;
  readonly type: ApiKeyErrorType;
  readonly retryAfter?: number;

  constructor(status: number, type: ApiKeyErrorType, message: string, retryAfter?: number) {
    super(message);
    this.name = 'ApiKeyError';
    this.status = status;
    this.type = type;
    this.retryAfter = retryAfter;
  }
}

export interface ApiKeyErrorBody {
  error: {
    type: ApiKeyErrorType;
    status: number;
    message: string;
  };
}

export function toErrorBody(error: ApiKeyError): ApiKeyErrorBody {
  return { error: { type: error.type, status: error.status, message: error.message } };
}

export function invalidApiKey(message = 'Invalid API key'): ApiKeyError {
  return new ApiKeyError(401, 'invalid_api_key', message);
}

export function forestIdentityNotAllowed(message = 'Forest identity not allowed'): ApiKeyError {
  return new ApiKeyError(403, 'forest_identity_not_allowed', message);
}

export function invalidRequest(message = 'Invalid request'): ApiKeyError {
  return new ApiKeyError(400, 'invalid_request', message);
}

export function keyResolutionUnavailable(
  retryAfter: number,
  message = 'Key resolution unavailable',
): ApiKeyError {
  return new ApiKeyError(503, 'key_resolution_unavailable', message, retryAfter);
}
