import type { AiConfiguration } from './provider';
import type { RouterRouteArgs } from './schemas/route';
import type { ToolConfig } from './tool-provider-factory';
import type { AiProviderDefinition, AiRouter } from '@forestadmin/agent-toolkit';

import { extractMcpOauthTokensFromHeaders, injectOauthTokens } from './oauth-token-injector';
import { Router } from './router';

function resolveMcpConfigs(
  args: Parameters<AiRouter['route']>[0],
): Record<string, ToolConfig> | undefined {
  const tokensByMcpServerName = args.headers
    ? extractMcpOauthTokensFromHeaders(args.headers)
    : undefined;

  return injectOauthTokens({
    configs: args.toolConfigs as Record<string, ToolConfig> | undefined,
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
        // Cast is safe: AiRouter.route accepts any string, but Router validates
        // it at runtime via Zod against the allowed literal union (RouterRouteArgs).
        route: args =>
          router.route({
            route: args.route,
            body: args.body,
            query: args.query,
            toolConfigs: resolveMcpConfigs(args),
          } as RouterRouteArgs),
      };
    },
  };
}
