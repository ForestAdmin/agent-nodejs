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

// Turn an agent RPC error into a human-readable message. HTTP failures arrive as AgentHttpError
// (status + parsed body); everything else falls back to the raw message.
export default function parseAgentError(error: unknown): string | null {
  if (error instanceof AgentHttpError) {
    return jsonApiDetail(error.body, error.responseText) ?? error.message;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return (error as { message: string }).message || null;
  }

  return null;
}
