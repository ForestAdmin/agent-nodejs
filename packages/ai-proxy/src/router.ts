import type { AiConfiguration } from './provider';
import type { RouteArgs, RouterRouteArgs } from './schemas/route';
import type { ToolProvider } from './tool-provider';
import type { Logger } from '@forestadmin/datasource-toolkit';
import type { z } from 'zod';

import { AIBadRequestError } from './errors';
import getAiConfiguration from './get-ai-configuration';
import BraveToolProvider from './integrations/brave/brave-tool-provider';
import McpClient from './mcp-client';
import ProviderDispatcher from './provider-dispatcher';
import { RemoteTools } from './remote-tools';
import { routeArgsSchema } from './schemas/route';
import validateAiConfigurations from './validate-ai-configurations';
import { createToolProviders } from './tool-provider-factory';

export type {
  AiQueryArgs,
  Body,
  InvokeRemoteToolArgs,
  InvokeRemoteToolBody,
  Query,
  RemoteToolsArgs,
  RouteArgs,
  RouterRouteArgs,
} from './schemas/route';

// Keep these for backward compatibility
export type Route = RouteArgs['route'];

export class Router {
  private readonly localToolProviders: ToolProvider[];
  private readonly aiConfigurations: AiConfiguration[];
  private readonly logger?: Logger;

  constructor(params?: {
    aiConfigurations?: AiConfiguration[];
    localToolsApiKeys?: Record<string, string>;
    logger?: Logger;
  }) {
    this.aiConfigurations = params?.aiConfigurations ?? [];
    this.localToolProviders = Router.createLocalToolProviders(params?.localToolsApiKeys);
    this.logger = params?.logger;

    validateAiConfigurations(this.aiConfigurations);
  }

  private static createLocalToolProviders(apiKeys?: Record<string, string>): ToolProvider[] {
    const providers: ToolProvider[] = [];

    if (apiKeys?.AI_REMOTE_TOOL_BRAVE_SEARCH_API_KEY) {
      providers.push(
        new BraveToolProvider({ apiKey: apiKeys.AI_REMOTE_TOOL_BRAVE_SEARCH_API_KEY }),
      );
    }

    return providers;
  }

  /**
   * Route the request to the appropriate handler
   *
   * Routes:
   * - ai-query: Dispatch messages to the configured AI provider and return the response
   * - invoke-remote-tool: Execute a remote tool by name with the provided inputs
   * - remote-tools: Return the list of available remote tools definitions
   */
  async route(args: RouterRouteArgs) {
    // Validate input with Zod schema
    const result = routeArgsSchema.safeParse(args);

    if (!result.success) {
      throw new AIBadRequestError(Router.formatZodError(result.error));
    }

    const remoteToolProviders = createToolProviders(args.toolConfigs ?? {}, this.logger);
    const validatedArgs = result.data;
    const providers = [...this.localToolProviders, ...remoteToolProviders];

    try {
      const allTools = (await Promise.all(providers.map(p => p.loadTools()))).flat();
      const remoteTools = new RemoteTools(allTools);

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
            validatedArgs.query['source-id'],
          );

        case 'remote-tools':
          return remoteTools.toolDefinitionsForFrontend;

        /* istanbul ignore next */
        default: {
          const exhaustiveCheck: never = validatedArgs;

          return exhaustiveCheck;
        }
      }
    } finally {
      const disposeResults = await Promise.allSettled(remoteToolProviders.map(p => p.dispose()));

      for (const disposeResult of disposeResults) {
        if (disposeResult.status === 'rejected') {
          const disposeError =
            disposeResult.reason instanceof Error
              ? disposeResult.reason
              : new Error(String(disposeResult.reason));
          this.logger?.('Error', 'Error during tool provider cleanup', disposeError);
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
