import type { McpConfiguration } from './mcp-client';
import type { AiConfiguration } from './provider-dispatcher';
import type { RemoteToolsApiKeys } from './remote-tools';
import type { AiQueryQuery, AiQueryRequest, InvokeToolQuery, InvokeToolRequest } from './types';
import type { Logger } from '@forestadmin/datasource-toolkit';

import { AIBadRequestError, AIUnprocessableError, ProviderDispatcher } from './index';
import McpClient from './mcp-client';
import { RemoteTools } from './remote-tools';

export type Route = 'ai-query' | 'remote-tools' | 'invoke-remote-tool';
export type Body = AiQueryRequest | InvokeToolRequest | undefined;
export type Query = Partial<AiQueryQuery & InvokeToolQuery>;
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
        const fallback = this.aiConfigurations[0];
        this.logger?.(
          'Warn',
          `AI configuration '${aiName}' not found. Falling back to '${fallback.name}'.`,
        );

        return fallback;
      }

      return config;
    }

    return this.aiConfigurations[0];
  }

  /**
   * Route the request to the appropriate handler
   *
   * Routes:
   * - ai-query: Dispatch messages to the configured AI provider and return the response
   * - invoke-remote-tool: Execute a remote tool by name with the provided inputs
   * - remote-tools: Return the list of available remote tools definitions
   */
  async route(args: { body?: Body; route: Route; query?: Query; mcpConfigs?: McpConfiguration }) {
    let mcpClient: McpClient | undefined;

    try {
      if (args.mcpConfigs) {
        mcpClient = new McpClient(args.mcpConfigs, this.logger);
      }

      const remoteTools = new RemoteTools(
        this.localToolsApiKeys ?? {},
        await mcpClient?.loadTools(),
      );

      if (args.route === 'ai-query') {
        const aiConfiguration = this.getAiConfiguration(args.query?.['ai-name']);

        return await new ProviderDispatcher(aiConfiguration, remoteTools).dispatch(
          args.body as AiQueryRequest,
        );
      }

      if (args.route === 'invoke-remote-tool') {
        const toolName = args.query?.['tool-name'];

        if (!toolName) {
          throw new AIBadRequestError('Missing required query parameter: tool-name');
        }

        const body = args.body as InvokeToolRequest | undefined;

        if (!body?.inputs) {
          throw new AIBadRequestError('Missing required body parameter: inputs');
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
          const error =
            cleanupError instanceof Error ? cleanupError : new Error(String(cleanupError));
          this.logger?.('Error', 'Error during MCP connection cleanup', error);
        }
      }
    }
  }
}
