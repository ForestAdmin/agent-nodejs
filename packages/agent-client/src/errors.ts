/* eslint-disable max-classes-per-file */

// Typed transport error: status + parsed body (JSON:API `{ errors: [...] }` when available, else
// raw text). Callers read fields directly instead of parsing a stringified message.
export default class AgentHttpError extends Error {
  constructor(readonly status: number, readonly body: unknown, readonly responseText?: string) {
    super(`Agent responded with HTTP ${status}`);
    this.name = 'AgentHttpError';
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
  constructor(message: string) {
    super(message);
    this.name = 'ActionFormValidationError';
  }
}
