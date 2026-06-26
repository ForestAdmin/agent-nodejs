export class OAuthRequestError extends Error {
  readonly status: number;
  readonly type: string;

  constructor(status: number, type: string, message: string) {
    super(message);
    this.name = 'OAuthRequestError';
    this.status = status;
    this.type = type;
  }
}

export interface OAuthErrorBody {
  error: { type: string; status: number; message: string };
}

export function toErrorBody(error: OAuthRequestError): OAuthErrorBody {
  return { error: { type: error.type, status: error.status, message: error.message } };
}

export function invalidRequest(message: string): OAuthRequestError {
  return new OAuthRequestError(400, 'invalid_request', message);
}

export function invalidClient(message: string): OAuthRequestError {
  return new OAuthRequestError(400, 'invalid_client', message);
}

export function invalidGrant(message: string): OAuthRequestError {
  return new OAuthRequestError(400, 'invalid_grant', message);
}

export function unsupportedGrantType(message: string): OAuthRequestError {
  return new OAuthRequestError(400, 'unsupported_grant_type', message);
}

export function forestIdentityNotAllowed(message: string): OAuthRequestError {
  return new OAuthRequestError(403, 'forest_identity_not_allowed', message);
}

export function sessionExpired(message: string): OAuthRequestError {
  return new OAuthRequestError(401, 'session_expired', message);
}

export function serverError(message: string): OAuthRequestError {
  return new OAuthRequestError(502, 'server_error', message);
}
