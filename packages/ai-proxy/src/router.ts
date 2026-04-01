import type { McpConfiguration } from './mcp-client';
import type { AiConfiguration } from './provider';
import type { RemoteToolsApiKeys } from './remote-tools';
import type { RouteArgs } from './schemas/route';
import type { Logger } from '@forestadmin/datasource-toolkit';
import type { z } from 'zod';

import { AIBadRequestError } from './errors';
import getAiConfiguration from './get-ai-configuration';
import McpClient from './mcp-client';
import ProviderDispatcher from './provider-dispatcher';
import { RemoteTools } from './remote-tools';
import { routeArgsSchema } from './schemas/route';
import validateAiConfigurations from './validate-ai-configurations';

export type {
  AiQueryArgs,
  Body,
  InvokeRemoteToolArgs,
  InvokeRemoteToolBody,
  Query,
  RemoteToolsArgs,
  RouteArgs,
} from './schemas/route';

// Keep these for backward compatibility
export type Route = RouteArgs['route'];
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

    validateAiConfigurations(this.aiConfigurations);
  }

  /**
   * Route the request to the appropriate handler
   *
   * Routes:
   * - ai-query: Dispatch messages to the configured AI provider and return the response
   * - invoke-remote-tool: Execute a remote tool by name with the provided inputs
   * - remote-tools: Return the list of available remote tools definitions
   */
  async route(args: RouteArgs & { mcpConfigs?: McpConfiguration }) {
    // Validate input with Zod schema
    const result = routeArgsSchema.safeParse(args);

    if (!result.success) {
      throw new AIBadRequestError(Router.formatZodError(result.error));
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

      switch (validatedArgs.route) {
        case 'ai-query': {
          const aiConfiguration = getAiConfiguration(
            this.aiConfigurations,
            validatedArgs.query?.['ai-name'],
            this.logger,
          );

          return await new ProviderDispatcher(aiConfiguration, remoteTools).dispatch(
            validatedArgs.body,
          );
        }

        case 'invoke-remote-tool':
          return await remoteTools.invokeTool(
            validatedArgs.query['tool-name'],
            validatedArgs.body.inputs,
          );

        case 'remote-tools':
          return remoteTools.toolDefinitionsForFrontend;

        /* istanbul ignore next */
        default: {
          // Exhaustive type check - this code never runs at runtime because Zod validation
          // catches unknown routes earlier. However, it provides compile-time safety:
          // if a new route is added to routeArgsSchema, TypeScript will error here with
          // "Type 'NewRouteArgs' is not assignable to type 'never'", forcing the developer
          // to add a corresponding case handler.
          const exhaustiveCheck: never = validatedArgs;

          return exhaustiveCheck;
        }
      }
    } finally {
      if (mcpClient) {
        try {
          await mcpClient.dispose();
        } catch (cleanupError) {
          const error =
            cleanupError instanceof Error ? cleanupError : new Error(String(cleanupError));
          this.logger?.('Error', 'Error during MCP connection cleanup', error);
        }
      }
    }
  }

  private static formatZodError(error: z.core.$ZodError): string {
    return error.issues
      .map(issue => {
        // Handle discriminatedUnion errors with helpful message
        // Zod 4 uses 'invalid_union' code with a 'discriminator' property for these errors
        if (issue.code === 'invalid_union' && issue.discriminator) {
          const validRoutes = routeArgsSchema.options.map(opt => `'${opt.shape.route.value}'`);

          return `Invalid route. Expected: ${validRoutes.join(', ')}`;
        }

        // Include path for context when available
        const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';

        return `${path}${issue.message}`;
      })
      .join('; ');
  }
}
