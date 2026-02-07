import type { AiConfiguration } from './provider';
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
            mcpConfigs: args.mcpServerConfigs as Parameters<typeof injectOauthTokens>[0]['mcpConfigs'],
            tokensByMcpServerName,
          });

          return router.route({
            route: args.route,
            body: args.body,
            query: args.query,
            mcpConfigs,
          } as any);
        },
      };
    },
  };
}
