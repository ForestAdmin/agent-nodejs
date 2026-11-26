/* eslint-disable max-classes-per-file */

export type AgentFailureKind = 'forbidden' | 'unreachable' | 'overloaded' | 'failed';

const FORBIDDEN_STATUSES: ReadonlySet<number> = new Set([401, 403]);
const UNREACHABLE_STATUSES: ReadonlySet<number> = new Set([502, 503, 504]);
const OVERLOADED_STATUSES: ReadonlySet<number> = new Set([408, 429]);

const isRetryable = (kind: AgentFailureKind): boolean =>
  kind === 'unreachable' || kind === 'overloaded';

type ErrorBody = {
  errors?: { detail?: unknown; message?: unknown; title?: unknown }[];
  error?: unknown;
  message?: unknown;
};

function firstNonEmptyString(candidates: unknown[]): string | undefined {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim() !== '') return candidate.trim();
  }

  return undefined;
}

// Only a recognised error shape yields a detail. A raw body or responseText is whatever the agent's
// host emitted -- an HTML error page, a proxy notice, a stack trace -- and it would reach the client
// verbatim as the action error message, so it is left out and callers use their own wording.
export function errorDetailOf(body: unknown): string | undefined {
  const { errors, error, message } = (body ?? {}) as ErrorBody;
  const first = errors?.[0];

  return firstNonEmptyString([first?.detail, first?.message, first?.title, error, message]);
}

export abstract class AgentCallError extends Error {
  abstract readonly kind: AgentFailureKind;

  get retryable(): boolean {
    return isRetryable(this.kind);
  }

  get httpStatus(): number | undefined {
    return undefined;
  }
}

// Typed transport error: status + parsed body (JSON:API `{ errors: [...] }` when available, else
// raw text). Callers read fields directly instead of parsing a stringified message.
export default class AgentHttpError extends AgentCallError {
  constructor(readonly status: number, readonly body: unknown, readonly responseText?: string) {
    super(`Agent responded with HTTP ${status}`);
    this.name = 'AgentHttpError';
  }

  override get httpStatus(): number | undefined {
    return this.status >= 100 && this.status <= 599 ? this.status : undefined;
  }

  get kind(): AgentFailureKind {
    if (this.httpStatus === undefined) return 'unreachable';
    if (FORBIDDEN_STATUSES.has(this.status)) return 'forbidden';
    if (UNREACHABLE_STATUSES.has(this.status)) return 'unreachable';
    if (OVERLOADED_STATUSES.has(this.status)) return 'overloaded';

    return 'failed';
  }

  get detail(): string | undefined {
    return errorDetailOf(this.body);
  }

  get agentMessage(): string | undefined {
    return this.httpStatus !== undefined && this.status < 500 ? this.detail : undefined;
  }
}

// `code` stays superagent's timeout code so a caller that classifies on it keeps working.
export class AgentTimeoutError extends AgentCallError {
  readonly code = 'ECONNABORTED';

  readonly kind = 'unreachable';

  constructor(message: string, readonly timeoutMs?: number) {
    super(message);
    this.name = 'AgentTimeoutError';
  }
}

export class AgentUnreachableError extends AgentCallError {
  readonly kind = 'unreachable';

  readonly code: string;

  constructor(readonly cause: Error & { code: string }) {
    super(cause.message);
    this.name = 'AgentUnreachableError';
    this.code = cause.code;
  }
}

export class InProcessStreamingUnsupportedError extends Error {
  constructor() {
    super('Streaming is not supported over the in-process transport');
    this.name = 'InProcessStreamingUnsupportedError';
  }
}

export class ActionOutcomeUnknownError extends Error {
  constructor(readonly cause: unknown) {
    super('The action was sent to the agent but no answer came back, so it may have run.');
    this.name = 'ActionOutcomeUnknownError';
  }
}

// Semantic action errors: agent-client interprets the failure once so callers route on meaning, not
// status/body. `message` carries the agent's detail when available.
export class ActionRequiresApprovalError extends Error {
  constructor(message: string, readonly roleIdsAllowedToApprove?: number[]) {
    super(message);
    this.name = 'ActionRequiresApprovalError';
  }
}

export class ActionFormValidationError extends Error {
  constructor(
    message: string,
    readonly html?: string,
    readonly unstructuredCause?: AgentHttpError,
  ) {
    super(message);
    this.name = 'ActionFormValidationError';
  }
}

export class ActionValuesNotExecutableError extends ActionFormValidationError {
  constructor(
    readonly missingRequiredFields: string[],
    readonly invalidValues: { field: string; expected: string }[],
  ) {
    const reasons = [
      missingRequiredFields.length > 0 &&
        `required fields left empty: ${missingRequiredFields.join(', ')}`,
      invalidValues.length > 0 &&
        `invalid values: ${invalidValues
          .map(({ field, expected }) => `${field} (expected ${expected})`)
          .join(', ')}`,
    ].filter(Boolean);

    super(`The action cannot run: ${reasons.join('; ')}.`);
    this.name = 'ActionValuesNotExecutableError';
  }
}

export class UnknownActionFieldError extends Error {
  constructor(readonly fieldName: string) {
    super(`Field "${fieldName}" does not exist in this form`);
    this.name = 'UnknownActionFieldError';
  }
}

export class InvalidActionFileValueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidActionFileValueError';
  }
}

// The action is approval-gated, but filing the approval request failed — distinct from the action
// itself failing, so the caller can tell the two apart.
export class ApprovalRequestCreationError extends Error {
  constructor(readonly cause: unknown) {
    super('The action requires an approval, but the approval request could not be created.');
    this.name = 'ApprovalRequestCreationError';
  }
}

export type ActivityLogBlockedReason =
  | 'notAuthorized'
  | 'unavailable'
  | 'endpointAbsent'
  | 'dropped';

export class ActivityLogBlockedError extends Error {
  constructor(readonly reason: ActivityLogBlockedReason, readonly cause?: unknown) {
    super(
      `The operation was not performed because its activity log could not be written (${reason})`,
    );
    this.name = 'ActivityLogBlockedError';
  }
}
