# @forestadmin/mcp-server

Model Context Protocol (MCP) server for Forest Admin with OAuth authentication support.

## Overview

This MCP server provides HTTP REST API access to Forest Admin operations, enabling AI assistants and other MCP clients to interact with your Forest Admin data through a standardized protocol.

### Available Tools

| Tool | Description |
|------|-------------|
| `describeCollection` | Get the schema of a collection (fields, types, relations) |
| `list` | Retrieve records from a collection |
| `listRelated` | Retrieve related records |
| `create` | Create a new record |
| `update` | Update an existing record |
| `delete` | Delete records |
| `associate` | Associate records in a relation |
| `dissociate` | Dissociate records from a relation |
| `getActionForm` | Get the form fields for a custom action |
| `executeAction` | Execute a custom action |

## Usage

### With Forest Admin Agent

The MCP server is included with the Forest Admin agent. Simply call `mountAiMcpServer()`:

```typescript
import { createAgent } from '@forestadmin/agent';

const agent = createAgent(options)
  .addDataSource(myDataSource)
  .mountAiMcpServer();

agent.mountOnExpress(app);
agent.start();
```

The MCP server will be automatically initialized and mounted on your application.

#### Disabling Tools

You can restrict which tools are exposed by the MCP server using the `disabledTools` option:

```typescript
agent.mountAiMcpServer({
  disabledTools: ['create', 'update', 'delete'],
});
```

Available tool names: `describeCollection`, `list`, `listRelated`, `create`, `update`, `delete`, `associate`, `dissociate`, `getActionForm`, `executeAction`.

### Standalone Server

You can run the MCP server standalone using the CLI:

```bash
npx forest-mcp-server
```

Or from the package directory:

```bash
yarn start           # Production
yarn start:dev       # Development (loads .env file automatically)
```

#### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `FOREST_ENV_SECRET` | **Yes** | - | Your Forest Admin environment secret |
| `FOREST_AUTH_SECRET` | **Yes** | - | Your Forest Admin authentication secret (must match your agent) |
| `MCP_SERVER_PORT` | No | `3931` | Port for the HTTP server |
| `FOREST_MCP_DISABLED_TOOLS` | No | - | Comma-separated list of tools to disable (e.g. `create,update,delete`) |

#### Example Configuration

Create a `.env` file in the package directory:

```bash
FOREST_ENV_SECRET="your-env-secret"
FOREST_AUTH_SECRET="your-auth-secret"
```

Then run:

```bash
yarn start:dev
```

Or set the variables inline:

```bash
FOREST_ENV_SECRET="your-env-secret" FOREST_AUTH_SECRET="your-auth-secret" npx forest-mcp-server
```

## Disabling Tools

You can restrict which tools are exposed by the MCP server.

**Read-only mode** — disable all write operations:

```typescript
// With Forest Admin Agent
agent.mountAiMcpServer({
  disabledTools: ['create', 'update', 'delete', 'associate', 'dissociate', 'getActionForm', 'executeAction'],
});
```

```bash
# Standalone
export FOREST_MCP_DISABLED_TOOLS="create,update,delete,associate,dissociate,getActionForm,executeAction"
npx forest-mcp-server
```

This keeps only `list`, `listRelated` and `describeCollection` available.

**Custom selection** — disable specific tools:

```typescript
agent.mountAiMcpServer({
  disabledTools: ['create', 'delete'],
});
```

See [Available Tools](#available-tools) for the full list. Note: `describeCollection` cannot be disabled as it is required for the MCP server to function properly.

## API Endpoints

Once running, the MCP server exposes the following endpoints:

| Method | Path | Description |
|--------|------|-------------|
| POST | `/mcp` | Main MCP protocol endpoint (requires Bearer token) |
| POST | `/oauth/authorize` | OAuth 2.0 authorization |
| POST | `/oauth/token` | OAuth 2.0 token exchange |
| GET | `/.well-known/oauth-protected-resource/mcp` | OAuth metadata discovery |

The `/mcp` endpoint expects MCP protocol messages (JSON-RPC 2.0) and requires a valid OAuth Bearer token with at least the `mcp:read` scope.

## Features

- **HTTP Transport**: Uses streamable HTTP transport for MCP communication
- **OAuth Authentication**: Built-in OAuth 2.0 with scopes (`mcp:read`, `mcp:write`, `mcp:action`, `mcp:admin`)
- **CORS Enabled**: Allows cross-origin requests
- **Express-based**: Built on top of Express.js for reliability and extensibility

## Development

### Building

```bash
yarn build
```

### Watch Mode

```bash
yarn build:watch
```

### Linting

```bash
yarn lint
```

### Testing

```bash
yarn test
```

### Cleaning

```bash
yarn clean
```

### Internal Environment Variables

These are only needed by Forest Admin developers (e.g. to point to a local or staging server):

| Variable | Default | Description |
|----------|---------|-------------|
| `FOREST_SERVER_URL` | `https://api.forestadmin.com` | Forest Admin API URL |
| `FOREST_APP_URL` | `https://app.forestadmin.com` | Forest Admin application URL |

## Architecture

The server consists of:

- **ForestMCPServer**: Main server class managing the MCP server lifecycle
- **McpServer**: Core MCP protocol implementation
- **StreamableHTTPServerTransport**: HTTP transport layer for MCP
- **Express App**: HTTP server handling incoming requests

## License

GPL-3.0

## Repository

[https://github.com/ForestAdmin/agent-nodejs](https://github.com/ForestAdmin/agent-nodejs)

## Support

For issues and feature requests, please visit the [GitHub repository](https://github.com/ForestAdmin/agent-nodejs/tree/main/packages/mcp-server).
