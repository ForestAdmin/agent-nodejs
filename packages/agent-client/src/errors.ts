/* eslint-disable max-classes-per-file */

// Typed transport error: status + parsed body (JSON:API `{ errors: [...] }` when available, else
// raw text). Callers read fields directly instead of parsing a stringified message.
export default class AgentHttpError extends Error {
  constructor(readonly status: number, readonly body: unknown, readonly responseText?: string) {
    super(`Agent responded with HTTP ${status}`);
    this.name = 'AgentHttpError';
  }
}

// `code` stays superagent's timeout code so a caller that classifies on it keeps working.
export class AgentTimeoutError extends Error {
  readonly code = 'ECONNABORTED';

  constructor(message: string, readonly timeoutMs?: number) {
    super(message);
    this.name = 'AgentTimeoutError';
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
