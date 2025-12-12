# @forestadmin/mcp-server

Model Context Protocol (MCP) server for Forest Admin with OAuth authentication support.

## Overview

This MCP server provides HTTP REST API access to Forest Admin operations, enabling AI assistants and other MCP clients to interact with your Forest Admin data through a standardized protocol.

## Installation

```bash
npm install @forestadmin/mcp-server
```

## Usage

### Running the Server

You can start the server using the CLI:

```bash
npx forest-mcp-server
```

Or programmatically:

```bash
node dist/index.js
```

### Environment Variables

The following environment variables are required to run the server:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `FOREST_ENV_SECRET` | **Yes** | - | Your Forest Admin environment secret |
| `FOREST_AUTH_SECRET` | **Yes** | - | Your Forest Admin authentication secret (must match your agent) |
| `MCP_SERVER_PORT` | No | `3931` | Port for the HTTP server |

### Example Configuration

```bash
export FOREST_ENV_SECRET="your-env-secret"
export FOREST_AUTH_SECRET="your-auth-secret"
export MCP_SERVER_PORT=3931

npx forest-mcp-server
```

## API Endpoint

Once running, the MCP server exposes a single endpoint:

- **POST** `/mcp` - Main MCP protocol endpoint

The server expects MCP protocol messages in the request body and returns MCP-formatted responses.

## Features

- **HTTP Transport**: Uses streamable HTTP transport for MCP communication
- **OAuth Authentication**: Built-in support for Forest Admin OAuth
- **CORS Enabled**: Allows cross-origin requests
- **Express-based**: Built on top of Express.js for reliability and extensibility

## Development

### Building

```bash
npm run build
```

### Watch Mode

```bash
npm run build:watch
```

### Linting

```bash
npm run lint
```

### Testing

```bash
npm test
```

### Cleaning

```bash
npm run clean
```

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
