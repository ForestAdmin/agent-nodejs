import type { SegmentReadFailureKind } from '../errors';
import type { AgentHttpError } from '@forestadmin/agent-client';

import { classifyAgentError, extractErrorDetail } from '@forestadmin/agent-client';

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
  return new AgentPortError(operation, cause, agentErrorMessage(cause), {
    retryable: classifyAgentError(cause).retryable,
  });
}

export function classifyAgentFailure(cause: unknown): {
  failure: SegmentReadFailureKind;
  httpStatus?: number;
} {
  const { kind, httpStatus } = classifyAgentError(cause);

  return { failure: kind, ...(httpStatus !== undefined && { httpStatus }) };
}

export function segmentReadError(operation: string, cause: unknown): SegmentReadError {
  return new SegmentReadError(operation, cause, {
    ...classifyAgentFailure(cause),
    agentDetail: agentErrorDetail(cause),
    agentMessage: agentErrorMessage(cause),
  });
}
