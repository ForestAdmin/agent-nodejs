import type { ForestAdminHttpDriverServices } from '../../services';
import type { AgentOptionsWithDefaults } from '../../types';
import type { AiRouter } from '@forestadmin/datasource-toolkit';
import type KoaRouter from '@koa/router';
import type { Context } from 'koa';

import {
  BadRequestError,
  NotFoundError,
  UnprocessableError,
} from '@forestadmin/datasource-toolkit';

import { HttpCode, RouteType } from '../../types';
import BaseRoute from '../base-route';

export default class AiProxyRoute extends BaseRoute {
  readonly type = RouteType.PrivateRoute;
  private readonly aiRouter: AiRouter;

  constructor(
    services: ForestAdminHttpDriverServices,
    options: AgentOptionsWithDefaults,
    aiRouter: AiRouter,
  ) {
    super(services, options);
    this.aiRouter = aiRouter;
  }

  setupRoutes(router: KoaRouter): void {
    router.post('/_internal/ai-proxy/:route', this.handleAiProxy.bind(this));
  }

  private async handleAiProxy(context: Context): Promise<void> {
    try {
      const mcpServerConfigs =
        await this.options.forestAdminClient.mcpServerConfigService.getConfiguration();

      context.response.body = await this.aiRouter.route({
        route: context.params.route,
        body: context.request.body,
        query: context.query,
        mcpServerConfigs,
        requestHeaders: context.request.headers,
      });
      context.response.status = HttpCode.Ok;
    } catch (error) {
      const err = error as Error & { status?: number };

      if (typeof err.status === 'number' && err.status >= 400 && err.status < 600) {
        this.options.logger('Error', `AI proxy error: ${err.message}`, err);

        if (err.status === 400) throw new BadRequestError(err.message);
        if (err.status === 404) throw new NotFoundError(err.message);
        throw new UnprocessableError(err.message);
      }

      throw error;
    }
  }
}
