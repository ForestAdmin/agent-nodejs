/* eslint-disable max-classes-per-file */

// Typed HTTP error from the agent. Carries the status and the parsed response body so callers route
// on structured data instead of string-parsing a message. `body` is the parsed JSON:API error
// ({ errors: [...] }) when available, else the raw text; `responseText` keeps the raw body.
export default class AgentHttpError extends Error {
  constructor(readonly status: number, readonly body: unknown, readonly responseText?: string) {
    super(`Agent responded with HTTP ${status}`);
    this.name = 'AgentHttpError';
  }
}

// Semantic errors for action execution: agent-client interprets the HTTP failure once (status +
// JSON:API body) and exposes the meaning, so callers never inspect transport details. `message`
// carries the agent's own detail when available.
export class ActionRequiresApprovalError extends Error {
  constructor(message: string, readonly roleIdsAllowedToApprove?: number[]) {
    super(message);
    this.name = 'ActionRequiresApprovalError';
  }
}

export class ActionFormValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ActionFormValidationError';
  }
}
