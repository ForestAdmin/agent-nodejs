import type { McpConfiguration } from './mcp-client';
import type { AiConfiguration } from './provider';
import type { RouteArgs } from './schemas/route';
import type { AiProviderDefinition, AiRouter } from '@forestadmin/datasource-toolkit';

import { extractMcpOauthTokensFromHeaders, injectOauthTokens } from './oauth-token-injector';
import { Router } from './router';

function resolveMcpConfigs(args: Parameters<AiRouter['route']>[0]): McpConfiguration | undefined {
  const tokensByMcpServerName = args.requestHeaders
    ? extractMcpOauthTokensFromHeaders(args.requestHeaders)
    : undefined;

  return injectOauthTokens({
    mcpConfigs: args.mcpServerConfigs as McpConfiguration | undefined,
    tokensByMcpServerName,
  });
}

// eslint-disable-next-line import/prefer-default-export
export function createAiProvider(config: AiConfiguration): AiProviderDefinition {
  return {
    providers: [{ name: config.name, provider: config.provider, model: config.model }],
    init(logger) {
      const router = new Router({ aiConfigurations: [config], logger });

      return {
        route: args =>
          router.route({
            route: args.route,
            body: args.body,
            query: args.query,
            mcpConfigs: resolveMcpConfigs(args),
          } as RouteArgs & { mcpConfigs?: McpConfiguration }),
      };
    },
  };
}
