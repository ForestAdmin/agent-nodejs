import type { McpConfiguration } from './mcp-client';
import type { Clients, DispatchBody } from './provider-dispatcher';
import type { Messages, RemoteToolsApiKeys } from './remote-tools';
import type { Logger } from '@forestadmin/datasource-toolkit';

import { AIUnprocessableError, ProviderDispatcher } from './index';
import McpClient from './mcp-client';
import { RemoteTools } from './remote-tools';

export type InvokeRemoteToolBody = { inputs: Messages };
export type Body = DispatchBody | InvokeRemoteToolBody | undefined;
export type Route = 'ai-query' | 'remote-tools' | 'invoke-remote-tool';
export type Query = {
  provider?: string;
  'tool-name'?: string;
};
export type ApiKeys = RemoteToolsApiKeys;

export class Router {
  private readonly localToolsApiKeys?: ApiKeys;
  private readonly aiClients: Clients;
  private readonly logger?: Logger;

  constructor(params?: { aiClients: Clients; localToolsApiKeys?: ApiKeys; logger?: Logger }) {
    this.aiClients = params?.aiClients;
    this.localToolsApiKeys = params?.localToolsApiKeys;
    this.logger = params?.logger;
  }

  /**
   * Route the request to the appropriate handler
   *
   * List of routes:
   * // dispatch the query to the right provider
   * - /ai-query?provider=:providerName
   *
   * // invoke a remote tool by name
   * - /invoke-remote-tool?tool-name=:toolName
   *
   * // get the list of available remote tools
   * - /remote-tools
   */
  async route(args: { body?: Body; route: Route; query?: Query; mcpConfigs?: McpConfiguration }) {
    let mcpClient: McpClient | undefined;

    try {
      if (args.mcpConfigs) {
        mcpClient = new McpClient(args.mcpConfigs, this.logger);
      }

      const remoteTools = new RemoteTools(this.localToolsApiKeys, await mcpClient?.loadTools());

      if (args.route === 'ai-query') {
        return await new ProviderDispatcher(this.aiClients, remoteTools).dispatch(
          args.query.provider,
          args.body as DispatchBody,
        );
      }

      if (args.route === 'invoke-remote-tool') {
        return await remoteTools.invokeTool(
          args.query['tool-name'],
          (args.body as InvokeRemoteToolBody).inputs,
        );
      }

      if (args.route === 'remote-tools') {
        return remoteTools.toolDefinitionsForFrontend;
      }

      // don't add mcpConfigs to the error message, as it may contain sensitive information
      throw new AIUnprocessableError(
        `No action to perform: ${JSON.stringify({
          body: args.body,
          route: args.route,
          query: args.query,
        })}`,
      );
    } finally {
      if (mcpClient) {
        try {
          await mcpClient.closeConnections();
        } catch (cleanupError) {
          this.logger?.('Error', 'Error during MCP connection cleanup', cleanupError as Error);
        }
      }
    }
  }
}
