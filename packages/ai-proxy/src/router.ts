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
  'tool-name'?: string;
  'ai-name'?: string;
};
export type ApiKeys = RemoteToolsApiKeys;

export class Router {
  private readonly localToolsApiKeys?: ApiKeys;
  private readonly aiConfigurations: AiConfiguration[];
  private readonly logger?: Logger;

  constructor(params?: {
    aiConfigurations?: AiConfiguration[];
    localToolsApiKeys?: ApiKeys;
    logger?: Logger;
  }) {
    this.aiConfigurations = params?.aiConfigurations ?? [];
    this.localToolsApiKeys = params?.localToolsApiKeys;
    this.logger = params?.logger;
  }

  private getAiConfiguration(aiName?: string): AiConfiguration | null {
    if (this.aiConfigurations.length === 0) return null;

    if (aiName) {
      const config = this.aiConfigurations.find(c => c.name === aiName);

      if (!config) {
        const available = this.aiConfigurations.map(c => c.name).join(', ');
        throw new AIUnprocessableError(
          `AI configuration '${aiName}' not found. Available configurations: ${available}`,
        );
      }

      return config;
    }

    // Default to first configuration if no name specified
    return this.aiConfigurations[0];
  }

  /**
   * Route the request to the appropriate handler
   *
   * List of routes:
   * // dispatch the query to the AI
   * - /ai-query
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
        const aiConfiguration = this.getAiConfiguration(args.query?.['ai-name']);

        return await new ProviderDispatcher(aiConfiguration, remoteTools).dispatch(
          args.body as DispatchBody,
        );
      }

      if (args.route === 'invoke-remote-tool') {
        const toolName = args.query?.['tool-name'];

        if (!toolName) {
          throw new AIUnprocessableError('Missing required query parameter: tool-name');
        }

        const body = args.body as InvokeRemoteToolBody | undefined;

        if (!body?.inputs) {
          throw new AIUnprocessableError('Missing required body parameter: inputs');
        }

        return await remoteTools.invokeTool(toolName, body.inputs);
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
