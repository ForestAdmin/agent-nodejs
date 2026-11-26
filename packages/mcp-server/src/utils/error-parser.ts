import { AgentHttpError, classifyAgentError } from '@forestadmin/agent-client';

// Turn an agent RPC error into a human-readable message: the agent's own 4xx message with its HTTP
// status when it has one, else the generic message (which already carries the status).
export default function parseAgentError(error: unknown, depth = 0): string | null {
  if (error instanceof AgentHttpError) {
    const { agentMessage } = classifyAgentError(error);

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
