import type { SegmentReadFailureKind } from '../errors';

import { AgentHttpError, extractErrorDetail } from '@forestadmin/agent-client';

import { AgentPortError, SegmentReadError } from '../errors';

const AGENT_ERROR_MESSAGE_MAX_LENGTH = 500;

type AgentHttpResponse = Pick<AgentHttpError, 'status' | 'body'>;

function isAgentHttpResponse(cause: unknown): cause is AgentHttpResponse {
  return cause instanceof Error && typeof (cause as Partial<AgentHttpResponse>).status === 'number';
}

export function flattenAgentMessage(detail: string): string {
  const flat = Array.from(detail.slice(0, AGENT_ERROR_MESSAGE_MAX_LENGTH * 4), char =>
    char < ' ' || (char >= '\u007f' && char <= '\u009f') ? ' ' : char,
  )
    .join('')
    .replace(/\s+/g, ' ')
    .trim();

  return flat.length > AGENT_ERROR_MESSAGE_MAX_LENGTH
    ? `${flat.slice(0, AGENT_ERROR_MESSAGE_MAX_LENGTH)}…`
    : flat;
}

export function agentErrorDetail(cause: unknown): string | undefined {
  if (!isAgentHttpResponse(cause)) return undefined;
  const detail = extractErrorDetail(cause);

  return detail ? flattenAgentMessage(detail) : undefined;
}

function agentErrorMessage(cause: unknown): string | undefined {
  return isAgentHttpResponse(cause) && cause.status >= 500 ? agentErrorDetail(cause) : undefined;
}

export function agentPortError(operation: string, cause: unknown): AgentPortError {
  return new AgentPortError(operation, cause, agentErrorMessage(cause));
}

const FORBIDDEN_AGENT_STATUSES: ReadonlySet<number> = new Set([401, 403]);

const UNREACHABLE_AGENT_STATUSES: ReadonlySet<number> = new Set([502, 503, 504]);

const OVERLOADED_AGENT_STATUSES: ReadonlySet<number> = new Set([408, 429]);

// Superagent's own timeout is ECONNABORTED. Any other failure without an HTTP answer (a JWT that
// cannot be signed, a malformed agent URL) is a fault on our side, not an agent to go and restart.
const UNREACHABLE_AGENT_ERROR_CODES: ReadonlySet<string> = new Set([
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

// agent-client reports status 0 when a response carries none. 0 is not a real HTTP status, so a
// read that lands there reached no answer worth classifying by code: treat it as unreachable.
const isHttpStatus = (status: number): boolean => status >= 100 && status <= 599;

export function classifyAgentFailure(cause: unknown): {
  failure: SegmentReadFailureKind;
  httpStatus?: number;
} {
  if (!(cause instanceof AgentHttpError)) {
    const code = (cause as { code?: unknown })?.code;

    return {
      failure:
        typeof code === 'string' && UNREACHABLE_AGENT_ERROR_CODES.has(code)
          ? 'unreachable'
          : 'failed',
    };
  }

  const httpStatus = cause.status;

  if (!isHttpStatus(httpStatus)) return { failure: 'unreachable' };
  if (FORBIDDEN_AGENT_STATUSES.has(httpStatus)) return { failure: 'forbidden', httpStatus };
  if (UNREACHABLE_AGENT_STATUSES.has(httpStatus)) return { failure: 'unreachable', httpStatus };
  if (OVERLOADED_AGENT_STATUSES.has(httpStatus)) return { failure: 'overloaded', httpStatus };

  return { failure: 'failed', httpStatus };
}

export function segmentReadError(operation: string, cause: unknown): SegmentReadError {
  return new SegmentReadError(operation, cause, {
    ...classifyAgentFailure(cause),
    agentDetail: agentErrorDetail(cause),
    agentMessage: agentErrorMessage(cause),
  });
}
