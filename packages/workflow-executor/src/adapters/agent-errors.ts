import type { SegmentReadFailureKind } from '../errors';

import { AgentCallError, AgentHttpError } from '@forestadmin/agent-client';

import { AgentPortError, SegmentReadError } from '../errors';

const AGENT_ERROR_MESSAGE_MAX_LENGTH = 500;

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
  const detail = cause instanceof AgentHttpError ? cause.detail : undefined;

  return detail ? flattenAgentMessage(detail) : undefined;
}

function agentErrorMessage(cause: unknown): string | undefined {
  return cause instanceof AgentHttpError && cause.status >= 500
    ? agentErrorDetail(cause)
    : undefined;
}

export function agentPortError(operation: string, cause: unknown): AgentPortError {
  return new AgentPortError(operation, cause, agentErrorMessage(cause), {
    retryable: cause instanceof AgentCallError && cause.retryable,
  });
}

export function classifyAgentFailure(cause: unknown): {
  failure: SegmentReadFailureKind;
  httpStatus?: number;
} {
  if (!(cause instanceof AgentCallError)) return { failure: 'failed' };

  const { kind, httpStatus } = cause;

  return { failure: kind, ...(httpStatus !== undefined && { httpStatus }) };
}

export function segmentReadError(operation: string, cause: unknown): SegmentReadError {
  return new SegmentReadError(operation, cause, {
    ...classifyAgentFailure(cause),
    agentDetail: agentErrorDetail(cause),
    agentMessage: agentErrorMessage(cause),
  });
}
