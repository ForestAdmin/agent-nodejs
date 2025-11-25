import { Tool } from '@modelcontextprotocol/sdk/types';

import OAuthClient from '../auth/oauth-client.js';

/**
 * Forest info tool - shows connection and authentication status
 */
export const forestInfoTool: Tool = {
  name: 'forest_info',
  description:
    'Get information about the Forest Admin MCP server connection status and authentication.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

/**
 * Forest authenticate tool - triggers the OAuth authentication flow
 */
export const forestAuthenticateTool: Tool = {
  name: 'forest_authenticate',
  description:
    'Authenticate with Forest Admin using OAuth. Opens a browser for login and returns user information.',
  inputSchema: {
    type: 'object',
    properties: {
      renderingId: {
        type: 'number',
        description: 'The Forest Admin rendering ID (default: 1)',
      },
      callbackPort: {
        type: 'number',
        description: 'Port for the local OAuth callback server (default: 3333)',
      },
    },
  },
};

/**
 * Handle forest_info tool
 */
export async function handleForestInfo(oauthClient: OAuthClient): Promise<string> {
  const agentHostname = oauthClient.getAgentHostname();
  const isInitialized = oauthClient.isInitialized();
  const isAuthenticated = oauthClient.isAuthenticated();
  const currentUser = oauthClient.getCurrentUser();

  const info = {
    status: 'connected',
    agentHostname,
    initialized: isInitialized,
    authenticated: isAuthenticated,
    user: isAuthenticated
      ? {
          email: currentUser?.email,
          name: `${currentUser?.firstName} ${currentUser?.lastName}`,
          role: currentUser?.role,
          team: currentUser?.team,
          renderingId: currentUser?.renderingId,
        }
      : null,
    message: isAuthenticated
      ? 'Successfully authenticated with Forest Admin'
      : 'Not authenticated. Use forest_authenticate tool to log in.',
    timestamp: new Date().toISOString(),
  };

  return JSON.stringify(info, null, 2);
}

/**
 * Handle forest_authenticate tool
 */
export async function handleForestAuthenticate(
  oauthClient: OAuthClient,
  args: { renderingId?: number; callbackPort?: number },
): Promise<string> {
  const renderingId = args.renderingId || 1;
  const callbackPort = args.callbackPort || 3333;

  const result = await oauthClient.authenticate(renderingId, callbackPort);

  if (result.authenticated && result.user) {
    return JSON.stringify(
      {
        success: true,
        message: 'Authentication successful!',
        user: {
          email: result.user.email,
          name: `${result.user.firstName} ${result.user.lastName}`,
          role: result.user.role,
          team: result.user.team,
          renderingId: result.user.renderingId,
          permissionLevel: result.user.permissionLevel,
        },
      },
      null,
      2,
    );
  }

  return JSON.stringify(
    {
      success: false,
      message: 'Authentication failed',
      error: result.error,
    },
    null,
    2,
  );
}
