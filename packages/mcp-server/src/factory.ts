import type { Logger } from './forest-oauth-provider';

import ForestAdminMCPServer from './server';
import type { HttpCallback } from './server';

/**
 * Context passed from the Forest Admin agent to the MCP factory.
 */
export interface McpFactoryContext {
  /** Forest Admin server URL */
  forestServerUrl: string;
  /** Environment secret */
  envSecret: string;
  /** Authentication secret */
  authSecret: string;
  /** Logger function */
  logger: Logger;
}

/**
 * Options for the MCP factory function.
 */
export interface McpFactoryOptions {
  /**
   * Optional override for the base URL where the agent is publicly accessible.
   * If not provided, it will be automatically fetched from Forest Admin API
   * (the environment's api_endpoint configuration).
   * Example: 'https://my-app.example.com' or 'http://localhost:3000'
   */
  baseUrl?: string;
}

/**
 * Factory function to create an MCP HTTP callback for use with the Forest Admin agent.
 *
 * This function is designed to be used with the `agent.useMcp()` method:
 *
 * @example
 * ```typescript
 * import { createAgent } from '@forestadmin/agent';
 * import { createMcpServer } from '@forestadmin/mcp-server';
 *
 * const agent = createAgent(options)
 *   .addDataSource(myDataSource)
 *   .useMcp(createMcpServer, { baseUrl: 'https://my-app.example.com' });
 *
 * agent.mountOnExpress(app);
 * agent.start();
 * ```
 *
 * @param context - Context containing Forest Admin configuration (provided by the agent)
 * @param options - Optional configuration for the MCP server
 * @returns An HTTP callback that handles MCP routes
 */
export async function createMcpServer(
  context: McpFactoryContext,
  options?: McpFactoryOptions,
): Promise<HttpCallback> {
  const mcpServer = new ForestAdminMCPServer({
    forestServerUrl: context.forestServerUrl,
    envSecret: context.envSecret,
    authSecret: context.authSecret,
    logger: context.logger,
  });

  const baseUrl = options?.baseUrl ? new URL('/', options.baseUrl) : undefined;

  return mcpServer.getHttpCallback(baseUrl);
}
