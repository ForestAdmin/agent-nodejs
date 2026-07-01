export type BffErrorType =
  | 'unauthorized'
  | 'ambiguous_credentials'
  | 'session_expired'
  | 'origin_not_allowed'
  | 'missing_timezone'
  | 'invalid_timezone';

export class BffHttpError extends Error {
  readonly status: number;
  readonly type: string;
  readonly details?: unknown;
  readonly retryAfter?: number;

  constructor(status: number, type: string, message: string, details?: unknown) {
    super(message);
    this.name = 'BffHttpError';
    this.status = status;
    this.type = type;
    this.details = details;
  }
}

export interface BffErrorBody {
  error: {
    type: string;
    status: number;
    message: string;
    details?: unknown;
  };
}

export function isSerializableError(error: unknown): error is {
  status: number;
  type: string;
  message: string;
  details?: unknown;
  retryAfter?: number;
} {
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { status?: unknown }).status === 'number' &&
    typeof (error as { type?: unknown }).type === 'string' &&
    typeof (error as { message?: unknown }).message === 'string'
  );
}

export function toErrorBody(error: {
  status: number;
  type: string;
  message: string;
  details?: unknown;
}): BffErrorBody {
  const body: BffErrorBody = {
    error: { type: error.type, status: error.status, message: error.message },
  };

  if (error.details !== undefined) body.error.details = error.details;

  return body;
}

export function unauthorized(message = 'Missing or invalid credentials'): BffHttpError {
  return new BffHttpError(401, 'unauthorized', message);
}

export function ambiguousCredentials(
  message = 'Both Authorization and X-Forest-Bff-Key were provided',
): BffHttpError {
  return new BffHttpError(400, 'ambiguous_credentials', message);
}

export function sessionExpired(message = 'The BFF session has expired'): BffHttpError {
  return new BffHttpError(401, 'session_expired', message);
}

export function originNotAllowed(message = 'Origin is not allowed for this key'): BffHttpError {
  return new BffHttpError(403, 'origin_not_allowed', message);
}

export function missingTimezone(
  message = 'A timezone is required but none was provided',
): BffHttpError {
  return new BffHttpError(400, 'missing_timezone', message);
}

export function invalidTimezone(value: string): BffHttpError {
  return new BffHttpError(400, 'invalid_timezone', `Invalid timezone: "${value}"`);
}
