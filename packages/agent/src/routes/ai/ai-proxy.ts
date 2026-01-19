import type { ForestAdminHttpDriverServices } from '../../services';
import type { AgentOptionsWithDefaults, AiConfiguration } from '../../types';
import type KoaRouter from '@koa/router';
import type { Context } from 'koa';

// eslint-disable-next-line import/no-extraneous-dependencies
import {
  AIError,
  AINotConfiguredError,
  AIToolNotFoundError,
  AIUnprocessableError,
  Router as AiProxyRouter,
} from '@forestadmin/ai-proxy';
import { UnprocessableError } from '@forestadmin/datasource-toolkit';

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
      context.response.body = await this.aiProxyRouter.route({
        route: context.params.route,
        body: context.request.body,
        query: context.query,
        mcpConfigs: await this.options.forestAdminClient.mcpServerConfigService.getConfiguration(),
      });
      context.response.status = HttpCode.Ok;
    } catch (error) {
      // Convert AI errors to framework errors for proper HTTP status codes
      if (error instanceof AINotConfiguredError) {
        throw new UnprocessableError(error.message);
      }

      if (error instanceof AIToolNotFoundError) {
        throw new UnprocessableError(error.message);
      }

      if (error instanceof AIUnprocessableError) {
        throw new UnprocessableError(error.message);
      }

      if (error instanceof AIError) {
        throw new UnprocessableError(error.message);
      }

      throw error;
    }
  }
}
