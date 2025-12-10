import { Router as AiProxyRouter } from '@forestadmin/ai-proxy';
import KoaRouter from '@koa/router';
import { Context } from 'koa';

import { ForestAdminHttpDriverServices } from '../../services';
import { AgentOptionsWithDefaults, AiLlmConfiguration, HttpCode, RouteType } from '../../types';
import BaseRoute from '../base-route';

export default class AiProxyRoute extends BaseRoute {
  readonly type = RouteType.PrivateRoute;
  private readonly aiProxyRouter: AiProxyRouter;

  constructor(
    services: ForestAdminHttpDriverServices,
    options: AgentOptionsWithDefaults,
    aiLlmConfig: AiLlmConfiguration,
  ) {
    super(services, options);
    this.aiProxyRouter = new AiProxyRouter({
      aiClients: aiLlmConfig,
      logger: this.options.logger,
    });
  }

  setupRoutes(router: KoaRouter): void {
    router.post('/ai-proxy/:route', this.handleAiProxy.bind(this));
  }

  private async handleAiProxy(context: Context): Promise<void> {
    context.response.body = await this.aiProxyRouter.route({
      route: context.params.route,
      body: context.request.body,
      query: context.query,
      mcpConfigs: await this.options.forestAdminClient.mcpServerConfigService.getConfiguration(),
    });
    context.response.status = HttpCode.Ok;
  }
}
