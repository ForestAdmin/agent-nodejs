import type { McpConfiguration } from './mcp-client';
import type { AiConfiguration } from './provider';
import type { RouteArgs } from './schemas/route';
import type { AiProviderDefinition } from '@forestadmin/datasource-toolkit';

import { extractMcpOauthTokensFromHeaders, injectOauthTokens } from './oauth-token-injector';
import { Router } from './router';

// eslint-disable-next-line import/prefer-default-export
export function createAiProvider(config: AiConfiguration): AiProviderDefinition {
  return {
    providers: [{ name: config.name, provider: config.provider, model: config.model }],
    init(logger) {
      const router = new Router({ aiConfigurations: [config], logger });

      return {
        route(args) {
          const tokensByMcpServerName = args.requestHeaders
            ? extractMcpOauthTokensFromHeaders(args.requestHeaders)
            : undefined;

          const mcpConfigs = injectOauthTokens({
            mcpConfigs: args.mcpServerConfigs as McpConfiguration | undefined,
            tokensByMcpServerName,
          });

          const routerArgs = {
            route: args.route,
            body: args.body,
            query: args.query,
            mcpConfigs,
          } as RouteArgs & { mcpConfigs?: McpConfiguration };

          return router.route(routerArgs);
        },
      };
    },
  };
}
