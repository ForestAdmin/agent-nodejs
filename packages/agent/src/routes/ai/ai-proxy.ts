import type { ForestAdminHttpDriverServices } from '../../services';
import type { AgentOptionsWithDefaults, AiConfiguration } from '../../types';
import type KoaRouter from '@koa/router';
import type { Context } from 'koa';

import {
  AIBadRequestError,
  AIError,
  AINotFoundError,
  Router as AiProxyRouter,
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
      const mcpOauthTokensHeader = context.request.headers['x-mcp-oauth-tokens'] as string;
      let mcpOAuthTokens: Record<string, string> | undefined;

      if (mcpOauthTokensHeader) {
        try {
          mcpOAuthTokens = JSON.parse(mcpOauthTokensHeader);
        } catch {
          throw new BadRequestError('Invalid JSON in x-mcp-oauth-tokens header');
        }
      }

      context.response.body = await this.aiProxyRouter.route({
        route: context.params.route,
        body: context.request.body,
        query: context.query,
        mcpConfigs: await this.options.forestAdminClient.mcpServerConfigService.getConfiguration(),
        mcpOAuthTokens,
      });
      context.response.status = HttpCode.Ok;
    } catch (error) {
      if (error instanceof AIError) {
        this.options.logger('Error', `AI proxy error: ${error.message}`, error);

        if (error instanceof AIBadRequestError) throw new BadRequestError(error.message);
        if (error instanceof AINotFoundError) throw new NotFoundError(error.message);
        throw new UnprocessableError(error.message);
      }

      throw error;
    }
  }
}
