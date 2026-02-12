import type { ForestAdminHttpDriverServices } from '../../services';
import type { AgentOptionsWithDefaults } from '../../types';
import type { AiRouter } from '@forestadmin/agent-toolkit';
import type KoaRouter from '@koa/router';
import type { Context } from 'koa';

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
    const mcpServerConfigs =
      await this.options.forestAdminClient.mcpServerConfigService.getConfiguration();

    context.response.body = await this.aiRouter.route({
      route: context.params.route,
      body: context.request.body,
      query: context.query,
      mcpServerConfigs,
      headers: context.request.headers,
    });
    context.response.status = HttpCode.Ok;
  }
}
