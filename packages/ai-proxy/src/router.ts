import type { McpConfiguration } from './mcp-client';
import type { AiConfiguration, DispatchBody } from './provider-dispatcher';
import type { Messages, RemoteToolsApiKeys } from './remote-tools';
import type { Logger } from '@forestadmin/datasource-toolkit';

import { AIUnprocessableError, ProviderDispatcher } from './index';
import McpClient from './mcp-client';
import { RemoteTools } from './remote-tools';

export type InvokeRemoteToolBody = { inputs: Messages };
export type Body = DispatchBody | InvokeRemoteToolBody | undefined;
export type Route = 'ai-query' | 'remote-tools' | 'invoke-remote-tool';
export type Query = {
  'client-name'?: string;
  'tool-name'?: string;
};
export type ApiKeys = RemoteToolsApiKeys;

export class Router {
  private readonly localToolsApiKeys?: ApiKeys;
  private readonly aiConfigurations: AiConfiguration[];
  private readonly logger?: Logger;

  constructor(params?: {
    aiConfigurations: AiConfiguration[];
    localToolsApiKeys?: ApiKeys;
    logger?: Logger;
  }) {
    this.aiConfigurations = params?.aiConfigurations ?? [];
    this.localToolsApiKeys = params?.localToolsApiKeys;
    this.logger = params?.logger;
  }

  /**
   * Route the request to the appropriate handler
   *
   * List of routes:
   * // dispatch the query to the AI client by name
   * - /ai-query?client-name=:clientName
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
        return await new ProviderDispatcher(this.aiConfigurations, remoteTools).dispatch(
          args.query['client-name'],
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
