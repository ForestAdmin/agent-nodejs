import type { ForestAdminHttpDriverServices } from '../../services';
import type { AgentOptionsWithDefaults, AiConfiguration } from '../../types';
import type KoaRouter from '@koa/router';
import type { Context } from 'koa';

import {
  AIBadRequestError,
  AIError,
  AINotConfiguredError,
  AINotFoundError,
  Router as AiProxyRouter,
  extractMcpOauthTokensFromHeaders,
  injectOauthTokens,
} from '@forestadmin/ai-proxy';
import {
  BadRequestError,
  NotFoundError,
  UnprocessableError,
} from '@forestadmin/datasource-toolkit';

import { HttpCode, RouteType } from '../../types';
import BaseRoute from '../base-route';

export default class AiProxyRoute extends BaseRoute {
  readonly type = RouteType.PrivateRoute;
  private readonly aiProxyRouter: AiProxyRouter;

  constructor(
    services: ForestAdminHttpDriverServices,
    options: AgentOptionsWithDefaults,
    aiConfigurations: AiConfiguration[],
  ) {
    super(services, options);
    this.aiProxyRouter = new AiProxyRouter({
      aiConfigurations,
      logger: this.options.logger,
    });
  }

  setupRoutes(router: KoaRouter): void {
    router.post('/_internal/ai-proxy/:route', this.handleAiProxy.bind(this));
  }

  private async handleAiProxy(context: Context): Promise<void> {
    try {
      const tokensByMcpServerName = extractMcpOauthTokensFromHeaders(context.request.headers);

      const mcpConfigs =
        await this.options.forestAdminClient.mcpServerConfigService.getConfiguration();

      context.response.body = await this.aiProxyRouter.route({
        route: context.params.route,
        body: context.request.body,
        query: context.query,
        mcpConfigs: injectOauthTokens({ mcpConfigs, tokensByMcpServerName }),
      });
      context.response.status = HttpCode.Ok;
    } catch (error) {
      if (error instanceof AIError) {
        this.options.logger('Error', `AI proxy error: ${error.message}`, error);

        if (error instanceof AINotConfiguredError) {
          throw new UnprocessableError(
            'AI is not configured. Please call addAi() on your agent.',
          );
        }

        if (error instanceof AIBadRequestError) throw new BadRequestError(error.message);
        if (error instanceof AINotFoundError) throw new NotFoundError(error.message);
        throw new UnprocessableError(error.message);
      }

      throw error;
    }
  }
}
