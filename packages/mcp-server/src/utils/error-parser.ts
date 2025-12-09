/**
 * Parse JSON:API error text to extract the detail message.
 */
function parseJsonApiErrorText(text: string): string | null {
  try {
    const parsed = JSON.parse(text) as {
      errors?: Array<{ detail?: string; name?: string }>;
    };

    if (parsed.errors?.[0]?.detail) {
      return parsed.errors[0].detail;
    }
  } catch {
    // Ignore parsing failures
  }

  return null;
}

/**
 * Parse error from the agent RPC client.
 * The error structure can vary:
 * - Error with message containing JSON: { error: { text: '{"errors":[{"detail":"..."}]}' } }
 * - Error with message containing JSON: { text: '{"errors":[{"detail":"..."}]}' }
 * - Error with message containing JSON: { message: '...' }
 * - Error with plain string message
 */
export default function parseAgentError(error: unknown): string | null {
  try {
    const err = JSON.parse((error as Error).message) as {
      error?: { text?: string };
      text?: string;
      message?: string;
    };

    // Try nested error.text first (e.g., { error: { text: '...' } })
    if (err.error?.text) {
      const detail = parseJsonApiErrorText(err.error.text);

      if (detail) return detail;
    }

    // Try direct text property (e.g., { text: '...' })
    if (err.text) {
      const detail = parseJsonApiErrorText(err.text);

      if (detail) return detail;
    }

    // Fallback to message property
    if (err.message) {
      return err.message;
    }

    return null;
  } catch {
    // If parsing fails, try to get message directly
    if (error && typeof error === 'object' && 'message' in error) {
      return (error as { message: string }).message || null;
    }

    return null;
  }
}
