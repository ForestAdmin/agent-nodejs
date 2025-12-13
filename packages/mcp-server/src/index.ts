// Library exports only - no side effects

// Express-based server (for CLI and standalone usage)
export { default as ForestMCPServer } from './server';
export type { ForestMCPServerOptions, HttpCallback } from './server';
export { createMcpServer } from './factory';
export type { McpFactoryContext, McpFactoryOptions } from './factory';

// Framework-agnostic handlers (for integration with any HTTP framework)
export { default as McpHandlers } from './handlers';
export type {
  McpHandlersOptions,
  AuthorizeParams,
  AuthorizeResult,
  TokenParams,
  TokenResult,
  McpResult,
  OAuthMetadata,
  OAuthProtectedResourceMetadata,
  Logger,
  LogLevel,
} from './handlers';

// Shared utilities
export { MCP_PATHS, isMcpRoute } from './mcp-paths';
