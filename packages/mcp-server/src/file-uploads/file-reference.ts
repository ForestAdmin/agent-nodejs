/**
 * Sentinel prefix used inside action form values, e.g.
 *   { "document": "$uploadedFile:<jwt>" }
 * A string rather than an object, so it passes the agent-client field validation and stays
 * cheap when getActionForm echoes it back into the model's context.
 */
export const UPLOADED_FILE_PREFIX = '$uploadedFile:';

/**
 * Isolated so that the file URIs the MCP specification is designing (SEP-2631) can be recognized
 * here without touching the resolution path.
 */
export default function parseFileReference(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith(UPLOADED_FILE_PREFIX)) return null;

  return value.slice(UPLOADED_FILE_PREFIX.length);
}
