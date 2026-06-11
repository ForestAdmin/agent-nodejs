/* eslint-disable max-classes-per-file */
import {
  RunAlreadyInFlightError,
  RunNotFoundError,
  RunStorePortError,
  UserMismatchError,
  WorkflowExecutorError,
  WorkflowPortError,
} from '../errors';

// HTTP-typed errors: each carries its response semantics (status + user-facing body) so the
// error-translation middleware can render any thrown error without per-handler branching.
// Hierarchy: BaseHttpError > abstract status class (NotFoundHttpError, …) > concrete case
// (RunNotFoundHttpError, …). Status classes are abstract on purpose — every response the server
// can produce is a named, greppable leaf class.
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

export abstract class BadRequestHttpError extends BaseHttpError {
  constructor(userMessage: string, options?: { log?: boolean; cause?: unknown }) {
    super(400, userMessage, options);
  }
}

export abstract class UnauthorizedHttpError extends BaseHttpError {
  constructor() {
    super(401, 'Unauthorized');
  }
}

export abstract class ForbiddenHttpError extends BaseHttpError {
  constructor(options?: { log?: boolean; cause?: unknown }) {
    super(403, 'Forbidden', options);
  }
}

export abstract class NotFoundHttpError extends BaseHttpError {
  constructor(userMessage: string) {
    super(404, userMessage);
  }
}

export abstract class ServiceUnavailableHttpError extends BaseHttpError {
  constructor(userMessage: string, options?: { log?: boolean; cause?: unknown }) {
    super(503, userMessage, options);
  }
}

export class InvalidTokenUserIdHttpError extends BadRequestHttpError {
  constructor() {
    super('Missing or invalid user id in token');
  }
}

export class RunAlreadyInFlightHttpError extends BadRequestHttpError {
  constructor(error: RunAlreadyInFlightError) {
    super(error.message, { cause: error });
  }
}

// Catch-all for domain errors surfacing through a handler: the request targeted a run/step whose
// state or configuration prevents execution, so the crafted userMessage is shown as a 400.
export class WorkflowStepFailedHttpError extends BadRequestHttpError {
  constructor(error: WorkflowExecutorError) {
    super(error.userMessage, { log: true, cause: error });
  }
}

// Concrete leaves: the abstract status classes above can't be instantiated, so every emitted
// response is one of these named leaf types.
export class MissingOrInvalidTokenHttpError extends UnauthorizedHttpError {}

export class RunAccessDeniedHttpError extends ForbiddenHttpError {}

export class UserMismatchHttpError extends ForbiddenHttpError {
  constructor(error: UserMismatchError) {
    super({ log: true, cause: error });
  }
}

export class RunNotFoundHttpError extends NotFoundHttpError {
  constructor() {
    super('Run not found or unavailable');
  }
}

// hasRunAccess could not be checked (orchestrator unreachable) — logged at the throw site, where
// the runId context lives.
export class RunAccessCheckUnavailableHttpError extends ServiceUnavailableHttpError {
  constructor(cause: unknown) {
    super('Service unavailable', { cause });
  }
}

// Store/orchestrator failures are server faults, not client mistakes: 503 (retryable), keeping
// the domain userMessage in the body.
export class UpstreamUnavailableHttpError extends ServiceUnavailableHttpError {
  constructor(error: RunStorePortError | WorkflowPortError) {
    super(error.userMessage, { log: true, cause: error });
  }
}

// The single domain→HTTP mapping. Returns null when the error has no HTTP translation —
// the middleware then responds 500 without leaking internals.
export function toHttpError(err: unknown): BaseHttpError | null {
  if (err instanceof BaseHttpError) return err;

  // koa-jwt rejects with an error object carrying status 401.
  if ((err as { status?: number })?.status === 401) return new MissingOrInvalidTokenHttpError();

  // All branches below match WorkflowExecutorError subtypes and MUST precede the catch-all:
  // each maps to a specific status (404/400/403/503), otherwise it would fall into the 400.
  if (err instanceof RunNotFoundError) return new RunNotFoundHttpError();
  if (err instanceof RunAlreadyInFlightError) return new RunAlreadyInFlightHttpError(err);
  if (err instanceof UserMismatchError) return new UserMismatchHttpError(err);

  if (err instanceof RunStorePortError || err instanceof WorkflowPortError) {
    return new UpstreamUnavailableHttpError(err);
  }

  // Catch-all for any other domain error: 400 with its userMessage (safe fallback — a new
  // WorkflowExecutorError subtype is never a silent 500).
  if (err instanceof WorkflowExecutorError) return new WorkflowStepFailedHttpError(err);

  return null;
}
