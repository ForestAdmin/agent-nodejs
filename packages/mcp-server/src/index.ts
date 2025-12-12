// Library exports only - no side effects

// Express-based server (original)
export { default as ForestMCPServer } from './server';
export type { ForestMCPServerOptions, HttpCallback } from './server';
export { createMcpServer } from './factory';

// Koa-based server (no Express dependency for Koa users)
export { default as KoaMcpServer } from './koa-server';
export type { KoaMcpServerOptions } from './koa-server';
export { createKoaMcpMiddleware } from './koa-factory';

// Shared
export { MCP_PATHS, isMcpRoute } from './mcp-paths';
export type { McpFactoryContext, McpFactoryOptions } from './factory';
