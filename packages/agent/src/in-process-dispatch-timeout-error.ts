/**
 * A dispatch that ran out of time, told apart from a failed one by its `code`. The BFF reads that
 * code as `AGENT_DISPATCH_TIMEOUT_CODE` through the structural `AgentDispatcher` contract, so it is
 * spelled out here, not imported.
 */
export default class InProcessDispatchTimeoutError extends Error {
  readonly code = 'AGENT_DISPATCH_TIMEOUT';

  constructor(timeoutMs: number) {
    super(`In-process dispatch timed out after ${timeoutMs}ms`);
    this.name = 'InProcessDispatchTimeoutError';
  }
}
