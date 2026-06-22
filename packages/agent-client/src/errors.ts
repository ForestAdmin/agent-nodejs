// Typed HTTP error from the agent. Carries the status and the parsed response body so callers route
// on structured data instead of string-parsing a message. `body` is the parsed JSON:API error
// ({ errors: [...] }) when available, else the raw text; `responseText` keeps the raw body.
export class AgentHttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
    readonly responseText?: string,
  ) {
    super(`Agent responded with HTTP ${status}`);
    this.name = 'AgentHttpError';
  }
}
