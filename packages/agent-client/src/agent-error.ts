import AgentHttpError, { AgentTimeoutError, AgentUnreachableError } from './errors';

/**
 * Failures after which a request may have reached the agent and run: a timeout, a connection reset
 * once the request was sent, or a gateway's 502 or 504 in front of the agent, which the agent itself
 * never answers. A refused connection or a 503 means the agent was never reached.
 */
export default function mayHaveRun(error: unknown): boolean {
  if (error instanceof AgentTimeoutError) return true;
  if (error instanceof AgentHttpError) return error.status === 502 || error.status === 504;

  return error instanceof AgentUnreachableError && error.code === 'ECONNRESET';
}
