import { AgentHttpError } from '@forestadmin/agent-client';

// Extract the JSON:API detail message from a parsed body or its raw text.
function jsonApiDetail(body: unknown, text?: string): string | null {
  const fromBody = (body as { errors?: Array<{ detail?: string }> })?.errors?.[0]?.detail;
  if (fromBody) return fromBody;

  if (typeof text === 'string') {
    try {
      const parsed = JSON.parse(text) as { errors?: Array<{ detail?: string }> };
      if (parsed.errors?.[0]?.detail) return parsed.errors[0].detail;
    } catch {
      // not JSON:API → fall through
    }
  }

  return null;
}

// Turn an agent RPC error into a human-readable message: the JSON:API detail with its HTTP status
// when one can be extracted, else the raw message (which already carries the status).
export default function parseAgentError(error: unknown, depth = 0): string | null {
  if (error instanceof AgentHttpError) {
    const detail = jsonApiDetail(error.body, error.responseText);

    return detail ? `${detail} (HTTP ${error.status})` : error.message;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const { message } = error as { message: string };
    // Wrapper errors (e.g. ApprovalRequestCreationError) carry the actionable detail — like the
    // Forest server's "limited to N records" 422 — in their cause: surface it alongside.
    const causeDetail =
      'cause' in error && depth < 3
        ? parseAgentError((error as { cause: unknown }).cause, depth + 1)
        : null;

    if (message && causeDetail) return `${message} ${causeDetail}`;

    return message || causeDetail;
  }

  return null;
}
