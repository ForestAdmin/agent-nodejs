import type { McpConfiguration } from './mcp-client';
import type { AiConfiguration } from './provider';
import type { RemoteToolsApiKeys } from './remote-tools';
import type { RouteArgs } from './schemas/route';
import type { Logger } from '@forestadmin/datasource-toolkit';
import type { z } from 'zod';

import { AIBadRequestError, AIModelNotSupportedError } from './errors';
import McpClient from './mcp-client';
import { ProviderDispatcher } from './provider-dispatcher';
import { RemoteTools } from './remote-tools';
import { routeArgsSchema } from './schemas/route';

/**
 * OpenAI model prefixes that do NOT support function calling (tools).
 * Unknown models are allowed.
 * @see https://platform.openai.com/docs/guides/function-calling
 */
const OPENAI_MODELS_WITHOUT_TOOLS_SUPPORT = [
  'gpt-4',
  'gpt-3.5-turbo',
  'gpt-3.5',
  'text-davinci',
  'davinci',
  'curie',
  'babbage',
  'ada',
];

/**
 * Exceptions to the unsupported list - these models DO support tools
 * even though they start with an unsupported prefix.
 */
const OPENAI_MODELS_EXCEPTIONS = ['gpt-4-turbo', 'gpt-4o', 'gpt-4.1'];

function isModelSupportingTools(model: string): boolean {
  const isException = OPENAI_MODELS_EXCEPTIONS.some(
    exception => model === exception || model.startsWith(`${exception}-`),
  );
  if (isException) return true;

  const isKnownUnsupported = OPENAI_MODELS_WITHOUT_TOOLS_SUPPORT.some(
    unsupported => model === unsupported || model.startsWith(`${unsupported}-`),
  );

  return !isKnownUnsupported;
}

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

    this.validateConfigurations();
  }

  private validateConfigurations(): void {
    for (const config of this.aiConfigurations) {
      if (!isModelSupportingTools(config.model)) {
        throw new AIModelNotSupportedError(config.model);
      }
    }
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
          const aiConfiguration = this.getAiConfiguration(validatedArgs.query?.['ai-name']);

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
          await mcpClient.closeConnections();
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
}
