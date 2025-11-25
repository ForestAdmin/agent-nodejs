# Forest Admin MCP Server

A standalone Model Context Protocol (MCP) server for Forest Admin that provides OAuth-authenticated access to Forest Admin operations.

## Overview

This package implements an MCP server that connects to a running Forest Admin agent and exposes Forest Admin operations as tools that can be used by MCP clients like Claude Code.

## Architecture

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   Client    │ ◄─────► │  HTTP Server     │ ◄─────► │ Forest Admin    │
│  (API/CLI)  │   HTTP  │ (this package)   │  OAuth  │ Agent (running) │
└─────────────┘         └──────────────────┘         └─────────────────┘
```

The server:
- Exposes HTTP REST API endpoints on port 3931 (configurable)
- Uses OAuth authentication from `@forestadmin/forestadmin-client`
- Connects to your Forest Admin agent running on `AGENT_HOSTNAME`

## Installation

From the monorepo root:

```bash
# Install dependencies
yarn bootstrap

# Build the package
yarn build
```

Or build just this package:

```bash
cd packages/mcp-server
yarn build
```

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `FOREST_ENV_SECRET` | Yes | - | Your Forest Admin environment secret for OAuth authentication |
| `AGENT_HOSTNAME` | No | `http://localhost:3310` | The URL where your Forest Admin agent is running |
| `FOREST_SERVER_URL` | No | - | Forest Admin server URL (optional, uses default if not set) |
| `MCP_SERVER_PORT` | No | `3931` | Port for the HTTP server |

### Example Configuration

Create a `.env` file or export these variables:

```bash
export FOREST_ENV_SECRET="your-forest-env-secret"
export AGENT_HOSTNAME="http://localhost:3310"
export MCP_SERVER_PORT="3931"
```

## Usage

### Running the Server

After building, run the server:

```bash
yarn start
```

Or using the binary directly:

```bash
node dist/index.js
```

The server will start on `http://localhost:3931` (or your configured port) and expose the following endpoints:

**MCP Tool Endpoints:**
- `GET /health` - Health check endpoint
- `GET /tools` - List available tools
- `POST /tools/execute` - Execute a tool

**OAuth/OIDC Endpoints:**
- `GET /.well-known/openid-configuration` - OIDC discovery endpoint
- `GET /.well-known/jwks.json` - JSON Web Key Set endpoint
- `GET /oauth/authorize` - OAuth authorization endpoint
- `POST /oauth/token` - OAuth token exchange endpoint
- `GET /oauth/userinfo` - OAuth user info endpoint

### API Endpoints

#### GET /health

Check server health and authentication status.

**Response:**
```json
{
  "status": "healthy",
  "authenticated": true,
  "agentHostname": "http://localhost:3310"
}
```

#### GET /tools

List all available tools.

**Response:**
```json
{
  "tools": [
    {
      "name": "forest_info",
      "description": "Get information about the Forest Admin MCP server...",
      "inputSchema": { "type": "object", "properties": {} }
    },
    {
      "name": "forest_authenticate",
      "description": "Authenticate with Forest Admin using OAuth...",
      "inputSchema": { ... }
    }
  ]
}
```

#### POST /tools/execute

Execute a tool.

**Request:**
```json
{
  "tool": "forest_info",
  "args": {}
}
```

**Response:**
```json
{
  "success": true,
  "result": "{\"status\":\"connected\", ...}"
}
```

## Available Tools

### `forest_info`

Get information about the MCP server connection status and current authentication state.

**Parameters:** None

**Returns:**
```json
{
  "status": "connected",
  "agentHostname": "http://localhost:3310",
  "initialized": true,
  "authenticated": true,
  "user": {
    "email": "user@example.com",
    "name": "John Doe",
    "role": "admin",
    "team": "Operations",
    "renderingId": 1
  },
  "message": "Successfully authenticated with Forest Admin",
  "timestamp": "2025-11-24T10:30:00.000Z"
}
```

### `forest_authenticate`

Trigger the OAuth authentication flow to log in to Forest Admin.

This tool:
1. Starts a temporary local HTTP server on `callbackPort` (default: 3333)
2. Generates an OAuth authorization URL
3. Prints the URL to stderr for the user to visit
4. Waits for the OAuth callback
5. Exchanges the authorization code for tokens
6. Returns user information

**Parameters:**
- `renderingId` (optional, number): The Forest Admin rendering ID (default: 1)
- `callbackPort` (optional, number): Port for the local OAuth callback server (default: 3333)

**Example:**
```json
{
  "renderingId": 1,
  "callbackPort": 3333
}
```

**Returns:**
```json
{
  "success": true,
  "message": "Authentication successful!",
  "user": {
    "email": "user@example.com",
    "name": "John Doe",
    "role": "admin",
    "team": "Operations",
    "renderingId": 1,
    "permissionLevel": "admin"
  }
}
```

## Development

### Building

```bash
yarn build
```

### Watch Mode

```bash
yarn build:watch
```

### Adding New Tools

1. Create a new tool definition in `src/tools/`:

```typescript
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import OAuthClient from '../auth/oauth-client.js';

export const myTool: Tool = {
  name: 'my_tool',
  description: 'Description of what the tool does',
  inputSchema: {
    type: 'object',
    properties: {
      // Define your input parameters
    },
  },
};

export async function handleMyTool(
  oauthClient: OAuthClient,
  args: { /* your args type */ }
): Promise<string> {
  // Check if authenticated
  if (!oauthClient.isAuthenticated()) {
    return JSON.stringify({
      error: 'Not authenticated. Use forest_authenticate tool first.',
    });
  }

  // Make authenticated requests to your agent
  const response = await oauthClient.makeAuthenticatedRequest('/your/api/path');

  return JSON.stringify(response, null, 2);
}
```

2. Register the tool in `src/index.ts`:
   - Import your tool and handler
   - Add to the `tools` array in `ListToolsRequestSchema` handler
   - Add a case in the switch statement in `CallToolRequestSchema` handler

## OAuth/OIDC Endpoints

The MCP server acts as an OAuth/OIDC provider, exposing standard endpoints for authentication flows.

### GET /.well-known/openid-configuration

OIDC discovery endpoint that returns OAuth/OIDC configuration metadata.

**Response:**
```json
{
  "issuer": "http://localhost:3931",
  "authorization_endpoint": "http://localhost:3931/oauth/authorize",
  "token_endpoint": "http://localhost:3931/oauth/token",
  "userinfo_endpoint": "http://localhost:3931/oauth/userinfo",
  "jwks_uri": "http://localhost:3931/.well-known/jwks.json",
  "response_types_supported": ["code"],
  "subject_types_supported": ["public"],
  "id_token_signing_alg_values_supported": ["RS256"],
  "scopes_supported": ["openid", "profile", "email"],
  "token_endpoint_auth_methods_supported": ["client_secret_basic", "none"],
  "claims_supported": ["sub", "email", "name", "given_name", "family_name"],
  "code_challenge_methods_supported": ["S256"]
}
```

### GET /oauth/authorize

OAuth authorization endpoint. Redirects to Forest Admin agent for authentication.

**Query Parameters:**
- `client_id` (optional): OAuth client ID (default: "mcp-client")
- `redirect_uri` (required): Callback URL after authentication
- `state` (optional): State parameter for CSRF protection
- `scope` (optional): Requested scopes (default: "openid profile email")
- `code_challenge` (optional): PKCE code challenge

**Response:**
- Redirects to Forest Admin agent's authentication endpoint
- After authentication, redirects back to `redirect_uri` with authorization code

### POST /oauth/token

OAuth token exchange endpoint. Exchanges authorization code for access token.

**Body Parameters (application/x-www-form-urlencoded):**
- `grant_type` (required): Must be "authorization_code"
- `code` (required): Authorization code from authorize endpoint
- `redirect_uri` (optional): Must match the redirect_uri from authorize request

**Response:**
```json
{
  "access_token": "...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "openid profile email"
}
```

### GET /oauth/userinfo

OAuth user info endpoint. Returns information about the authenticated user.

**Headers:**
- `Authorization: Bearer <access_token>`

**Response:**
```json
{
  "sub": "123",
  "email": "user@example.com",
  "name": "John Doe",
  "given_name": "John",
  "family_name": "Doe"
}
```

### GET /.well-known/jwks.json

JSON Web Key Set endpoint for token verification. Currently returns an empty key set.

**Response:**
```json
{
  "keys": []
}
```

## Authentication

The server implements a complete OAuth authentication flow using `@forestadmin/forestadmin-client`:

### OAuth Flow

1. **Initialization**: The `OAuthClient` initializes the Forest Admin client with your `FOREST_ENV_SECRET`
2. **Authentication Trigger**: When `forest_authenticate` tool is called:
   - Creates a temporary local HTTP server on port 3333 (configurable)
   - Generates an OAuth authorization URL
   - Prints the URL to stderr for the user to open in a browser
   - Waits for the OAuth callback with the authorization code
3. **Token Exchange**: Once the callback is received:
   - Exchanges the authorization code for access tokens
   - Retrieves user information from the Forest Admin API
   - Stores the access token for subsequent requests
4. **Authenticated Requests**: Tools can now use `oauthClient.makeAuthenticatedRequest()` to make authenticated HTTP requests to your agent

### Implementation Details

The OAuth client provides these key methods:

- `initialize()`: Initialize the OAuth client
- `authenticate(renderingId?, callbackPort?)`: Trigger the OAuth flow
- `isAuthenticated()`: Check if currently authenticated
- `getCurrentUser()`: Get the authenticated user info
- `makeAuthenticatedRequest<T>(path, options)`: Make authenticated HTTP requests to your agent

### Usage Example

```typescript
// Check authentication status
if (!oauthClient.isAuthenticated()) {
  // User needs to authenticate first
  console.error('Please authenticate using forest_authenticate tool');
}

// Make authenticated request
const collections = await oauthClient.makeAuthenticatedRequest<CollectionsResponse>(
  '/forest/collections',
  { method: 'GET' }
);
```

### Current Implementation Status

- ✅ OAuth client wrapper with full authentication flow
- ✅ MCP server setup with stdio transport
- ✅ Device-like OAuth flow for CLI tools
- ✅ Token management and storage
- ✅ Authenticated request helper methods
- ✅ Two working tools: `forest_info` and `forest_authenticate`

## Project Structure

```
packages/mcp-server/
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── auth/
│   │   └── oauth-client.ts   # OAuth client wrapper
│   └── tools/
│       └── placeholder.ts    # Example tool
├── package.json
├── tsconfig.json
└── README.md
```

## License

GPL-3.0

## Links

- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- [Forest Admin Documentation](https://docs.forestadmin.com/)
- [MCP SDK on npm](https://www.npmjs.com/package/@modelcontextprotocol/sdk)
