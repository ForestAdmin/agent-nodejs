import type { AiConfiguration } from './provider';
import type { RouterRouteArgs } from './schemas/route';
import type { ToolProvider } from './tool-provider';
import type { ToolSourceConfig } from './tool-provider-factory';
import type { AiProviderDefinition } from '@forestadmin/agent-toolkit';
import type { Logger } from '@forestadmin/datasource-toolkit';

import { extractMcpOauthTokensFromHeaders, injectOauthTokens } from './oauth-token-injector';
import { Router } from './router';
import { createToolProviders } from './tool-provider-factory';

interface AiRouterRouteArgs {
  route: string;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
  mcpServerConfigs?: unknown;
  headers?: Record<string, string | string[] | undefined>;
}

function resolveToolProviders(args: AiRouterRouteArgs, logger?: Logger): ToolProvider[] {
  const mcpServerConfigs = args.mcpServerConfigs as
    | { configs: Record<string, ToolSourceConfig> }
    | undefined;

  if (!mcpServerConfigs) return [];

  const { configs } = mcpServerConfigs;

  const tokensByMcpServerName = args.headers
    ? extractMcpOauthTokensFromHeaders(args.headers)
    : undefined;

  const configsWithTokens = injectOauthTokens({ configs, tokensByMcpServerName });

  if (!configsWithTokens) return [];

  return createToolProviders(configsWithTokens, logger);
}

// eslint-disable-next-line import/prefer-default-export
export function createAiProvider(config: AiConfiguration): AiProviderDefinition {
  return {
    providers: [{ name: config.name, provider: config.provider, model: config.model }],
    init(logger) {
      const router = new Router({ aiConfigurations: [config], logger });

      return {
        // Cast is safe: AiRouter.route accepts any string, but Router validates
        // it at runtime via Zod against the allowed literal union (RouterRouteArgs).
        route: args =>
          router.route({
            route: args.route,
            body: args.body,
            query: args.query,
            toolProviders: resolveToolProviders(args, logger),
          } as RouterRouteArgs),
      };
    },
  };
}
