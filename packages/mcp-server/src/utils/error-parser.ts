import { AgentHttpError } from '@forestadmin/agent-client';

export default function parseAgentError(error: unknown, depth = 0): string | null {
  if (error instanceof AgentHttpError) {
    const { agentMessage } = error;

    return agentMessage ? `${agentMessage} (HTTP ${error.status})` : error.message;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const { message } = error as { message: string };
    // Wrapper errors (e.g. ApprovalRequestCreationError) carry the actionable detail in `cause`.
    const causeDetail =
      'cause' in error && depth < 3
        ? parseAgentError((error as { cause: unknown }).cause, depth + 1)
        : null;

    if (message && causeDetail) return `${message} ${causeDetail}`;

    return message || causeDetail;
  }

  return null;
}
