import { extractErrorDetail } from './domains/action';
import AgentHttpError, { AgentTimeoutError } from './errors';

export type AgentFailureKind = 'forbidden' | 'unreachable' | 'overloaded' | 'failed';

export interface AgentErrorClassification {
  kind: AgentFailureKind;
  httpStatus?: number;
  agentMessage?: string;
  retryable: boolean;
}

const FORBIDDEN_STATUSES: ReadonlySet<number> = new Set([401, 403]);
const UNREACHABLE_STATUSES: ReadonlySet<number> = new Set([502, 503, 504]);
const OVERLOADED_STATUSES: ReadonlySet<number> = new Set([408, 429]);

// Superagent's own timeout is ECONNABORTED. Any other failure without an HTTP answer (a JWT that
// cannot be signed, a malformed agent URL) is a fault on the caller's side, not an agent to restart.
const UNREACHABLE_ERROR_CODES: ReadonlySet<string> = new Set([
  'ECONNABORTED',
  'ECONNREFUSED',
  'ECONNRESET',
  'EAI_AGAIN',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENOTFOUND',
  'EPIPE',
  'ETIMEDOUT',
]);

const isHttpStatus = (status: number): boolean => status >= 100 && status <= 599;

function kindOfStatus(status: number): AgentFailureKind {
  if (FORBIDDEN_STATUSES.has(status)) return 'forbidden';
  if (UNREACHABLE_STATUSES.has(status)) return 'unreachable';
  if (OVERLOADED_STATUSES.has(status)) return 'overloaded';

  return 'failed';
}

const isRetryable = (kind: AgentFailureKind): boolean =>
  kind === 'unreachable' || kind === 'overloaded';

export default function classifyAgentError(error: unknown): AgentErrorClassification {
  if (!(error instanceof AgentHttpError)) {
    const code = (error as { code?: unknown } | null)?.code;
    const kind =
      typeof code === 'string' && UNREACHABLE_ERROR_CODES.has(code) ? 'unreachable' : 'failed';

    return { kind, retryable: isRetryable(kind) };
  }

  const { status } = error;

  if (!isHttpStatus(status)) return { kind: 'unreachable', retryable: true };

  const kind = kindOfStatus(status);
  const agentMessage = status < 500 ? extractErrorDetail(error) : undefined;

  return {
    kind,
    httpStatus: status,
    ...(agentMessage !== undefined && { agentMessage }),
    retryable: isRetryable(kind),
  };
}

/**
 * Failures after which a request may have reached the agent and run: a timeout, a connection reset
 * once the request was sent, or a gateway's 502 or 504 in front of the agent, which the agent itself
 * never answers. A refused connection or a 503 means the agent was never reached.
 */
export function mayHaveRun(error: unknown): boolean {
  if (error instanceof AgentTimeoutError) return true;
  if (error instanceof AgentHttpError) return error.status === 502 || error.status === 504;

  return (error as { code?: unknown } | null)?.code === 'ECONNRESET';
}
