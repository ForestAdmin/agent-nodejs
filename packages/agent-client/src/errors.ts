/* eslint-disable max-classes-per-file */

// Typed transport error: status + parsed body (JSON:API `{ errors: [...] }` when available, else
// raw text). Callers read fields directly instead of parsing a stringified message.
export default class AgentHttpError extends Error {
  constructor(readonly status: number, readonly body: unknown, readonly responseText?: string) {
    super(`Agent responded with HTTP ${status}`);
    this.name = 'AgentHttpError';
  }
}

// The agents answer a by-id read or an update on a missing record with a 200 and no record
// (`data: null`) instead of a 404. A 404 status keeps callers that already check for one working.
export class RecordNotFoundError extends AgentHttpError {
  constructor(readonly collectionName: string, readonly recordId: string) {
    super(404, undefined);
    this.name = 'RecordNotFoundError';
    this.message = `Record "${recordId}" not found in collection "${collectionName}"`;
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
