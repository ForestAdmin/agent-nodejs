import type { Middleware } from 'koa';

import KoaMcpServer, { Logger } from './koa-server';

/**
 * Context passed from the Forest Admin agent to the MCP factory.
 */
export interface McpFactoryContext {
  forestServerUrl: string;
  envSecret: string;
  authSecret: string;
  logger: Logger;
}

/**
 * Options for the MCP factory function.
 */
export interface McpFactoryOptions {
  baseUrl?: string;
}

/**
 * Factory function to create a Koa middleware for MCP.
 *
 * This is a pure Koa implementation - no Express bridging needed!
 *
 * @example
 * ```typescript
 * import { createKoaMcpMiddleware } from '@forestadmin/mcp-server/koa';
 *
 * const mcpMiddleware = await createKoaMcpMiddleware(context, options);
 * koaApp.use(mcpMiddleware);
 * ```
 */
export async function createKoaMcpMiddleware(
  context: McpFactoryContext,
  options?: McpFactoryOptions,
): Promise<Middleware> {
  const mcpServer = new KoaMcpServer({
    forestServerUrl: context.forestServerUrl,
    envSecret: context.envSecret,
    authSecret: context.authSecret,
    logger: context.logger,
  });

  const baseUrl = options?.baseUrl ? new URL('/', options.baseUrl) : undefined;

  return mcpServer.getKoaMiddleware(baseUrl);
}
