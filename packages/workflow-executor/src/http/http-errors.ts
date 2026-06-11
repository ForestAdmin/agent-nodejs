/* eslint-disable max-classes-per-file */
import {
  AccessDeniedError,
  ConflictError,
  NotFoundError,
  UnavailableError,
  WorkflowExecutorError,
} from '../errors';

// HTTP-typed errors: each carries its response semantics (status + user-facing body) so the
// error-translation middleware can render any thrown error without per-handler branching. One
// concrete class per status; handlers throw them directly, and toHttpError maps domain error
// categories onto them.
export abstract class BaseHttpError extends Error {
  readonly status: number;
  readonly userMessage: string;
  // When true, the translation middleware logs the error (with its cause's stack) at error level.
  // Off by default so expected client churn (completed run, double trigger) is not noise-logged.
  readonly log: boolean;
  cause?: unknown;

  constructor(
    status: number,
    userMessage: string,
    options: { log?: boolean; cause?: unknown } = {},
  ) {
    super(userMessage);
    this.name = this.constructor.name;
    this.status = status;
    this.userMessage = userMessage;
    this.log = options.log ?? false;
    if (options.cause !== undefined) this.cause = options.cause;
  }
}

export class BadRequestHttpError extends BaseHttpError {
  constructor(userMessage: string, options?: { log?: boolean; cause?: unknown }) {
    super(400, userMessage, options);
  }
}

export class UnauthorizedHttpError extends BaseHttpError {
  constructor() {
    super(401, 'Unauthorized');
  }
}

export class ForbiddenHttpError extends BaseHttpError {
  // 403 bodies stay opaque ('Forbidden') on purpose — never echo why access was denied.
  constructor(options?: { log?: boolean; cause?: unknown }) {
    super(403, 'Forbidden', options);
  }
}

export class NotFoundHttpError extends BaseHttpError {
  constructor(userMessage: string, options?: { log?: boolean; cause?: unknown }) {
    super(404, userMessage, options);
  }
}

export class ConflictHttpError extends BaseHttpError {
  constructor(userMessage: string, options?: { log?: boolean; cause?: unknown }) {
    super(409, userMessage, options);
  }
}

export class ServiceUnavailableHttpError extends BaseHttpError {
  constructor(userMessage: string, options?: { log?: boolean; cause?: unknown }) {
    super(503, userMessage, options);
  }
}

// The single domain→HTTP mapping. Maps by domain category, not concrete class, so a new
// NotFoundError/ConflictError/… is translated correctly without touching this function. Returns
// null when the error has no HTTP translation — the middleware then responds 500 without leaking
// internals.
export function toHttpError(err: unknown): BaseHttpError | null {
  if (err instanceof BaseHttpError) return err;

  // koa-jwt rejects with an error object carrying status 401.
  if ((err as { status?: number })?.status === 401) return new UnauthorizedHttpError();

  // Category branches MUST precede the WorkflowExecutorError catch-all: every category extends it.
  if (err instanceof NotFoundError) return new NotFoundHttpError(err.userMessage, { cause: err });
  if (err instanceof ConflictError) return new ConflictHttpError(err.userMessage, { cause: err });
  if (err instanceof AccessDeniedError) return new ForbiddenHttpError({ log: true, cause: err });

  if (err instanceof UnavailableError) {
    return new ServiceUnavailableHttpError(err.userMessage, { log: true, cause: err });
  }

  // Uncategorized domain error: 400 with its userMessage (safe default — never a silent 500).
  if (err instanceof WorkflowExecutorError) {
    return new BadRequestHttpError(err.userMessage, { log: true, cause: err });
  }

  return null;
}
