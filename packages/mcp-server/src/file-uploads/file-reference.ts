/**
 * Sentinel prefix used inside action form values, e.g.
 *   { "document": "$uploadedFile:<jwt>" }
 * A string rather than an object, so it passes the agent-client field validation and stays
 * cheap when getActionForm echoes it back into the model's context.
 */
export const UPLOADED_FILE_PREFIX = '$uploadedFile:';

export type FileReference = { kind: 'uploadHandle'; handle: string };

/**
 * Recognizes the values that stand for a file the server must fetch itself.
 *
 * Isolated so that the file URIs the MCP specification is designing (SEP-2631) can be added
 * as another kind without touching the resolution path.
 */
export default function parseFileReference(value: unknown): FileReference | null {
  if (typeof value !== 'string' || !value.startsWith(UPLOADED_FILE_PREFIX)) return null;

  return { kind: 'uploadHandle', handle: value.slice(UPLOADED_FILE_PREFIX.length) };
}
