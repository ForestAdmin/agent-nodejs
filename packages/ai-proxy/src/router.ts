import type { McpConfiguration } from './mcp-client';
import type { AiConfiguration, DispatchBody } from './provider-dispatcher';
import type { RemoteToolsApiKeys } from './remote-tools';
import type { RouteArgs } from './schemas/route';
import type { Logger } from '@forestadmin/datasource-toolkit';
import type { z } from 'zod';

import { AIBadRequestError, AIUnprocessableError, ProviderDispatcher } from './index';
import McpClient from './mcp-client';
import { RemoteTools } from './remote-tools';
import { routeArgsSchema } from './schemas/route';

export type {
  AiQueryArgs,
  InvokeRemoteToolArgs,
  RemoteToolsArgs,
  RouteArgs,
} from './schemas/route';

// Keep these for backward compatibility
export type Route = RouteArgs['route'];
export type ApiKeys = RemoteToolsApiKeys;

function formatZodError(error: z.ZodError): string {
  return error.issues.map(issue => issue.message).join('; ');
}

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
  async route(args: {
    body?: unknown;
    route: string;
    query?: unknown;
    mcpConfigs?: McpConfiguration;
  }) {
    // Validate input with Zod schema
    const result = routeArgsSchema.safeParse(args);

    if (!result.success) {
      throw new AIBadRequestError(formatZodError(result.error));
    }

    const validatedArgs = result.data;
    let mcpClient: McpClient | undefined;

    try {
      if (args.mcpConfigs) {
        mcpClient = new McpClient(args.mcpConfigs, this.logger);
      }

      const remoteTools = new RemoteTools(
        this.localToolsApiKeys ?? {},
        await mcpClient?.loadTools(),
      );

      if (validatedArgs.route === 'ai-query') {
        const aiConfiguration = this.getAiConfiguration(validatedArgs.query?.['ai-name']);

        return await new ProviderDispatcher(aiConfiguration, remoteTools).dispatch(
          validatedArgs.body as DispatchBody,
        );
      }

      if (validatedArgs.route === 'invoke-remote-tool') {
        return await remoteTools.invokeTool(
          validatedArgs.query['tool-name'],
          validatedArgs.body.inputs,
        );
      }

      if (validatedArgs.route === 'remote-tools') {
        return remoteTools.toolDefinitionsForFrontend;
      }

      // This should never be reached due to Zod validation, but TypeScript doesn't know that
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
