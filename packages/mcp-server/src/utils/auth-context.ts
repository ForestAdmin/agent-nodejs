import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types.js';

/**
 * Extracts the caller's Forest identity from the MCP request auth context.
 * Populated by the OAuth provider's `verifyAccessToken` (see `forest-oauth-provider.ts`).
 */
export default function getAuthContext(
  request: RequestHandlerExtra<ServerRequest, ServerNotification>,
): { forestServerToken: string; renderingId: string } {
  const forestServerToken = request.authInfo?.extra?.forestServerToken;
  const renderingId = request.authInfo?.extra?.renderingId;

  if (!forestServerToken || typeof forestServerToken !== 'string') {
    throw new Error('Invalid or missing forestServerToken in authentication context');
  }

  // renderingId can be number (from JWT) or string - convert to string for API calls
  if (renderingId === undefined || renderingId === null) {
    throw new Error('Invalid or missing renderingId in authentication context');
  }

  return { forestServerToken, renderingId: String(renderingId) };
}
