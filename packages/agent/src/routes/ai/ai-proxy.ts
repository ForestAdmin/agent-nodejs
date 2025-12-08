import { Router as AiProxyRouter, Route } from '@forestadmin/ai-proxy';
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
      aiClients: aiLlmConfig.aiClients,
      logger: {
        error: (...args: unknown[]) => {
          this.options.logger('Error', String(args[0]));
        },
      },
    });
  }

  setupRoutes(router: KoaRouter): void {
    router.all('/ai-proxy/:route', this.handleAiProxy.bind(this));
  }

  private async handleAiProxy(context: Context): Promise<void> {
    const route = context.params.route as Route;

    context.response.body = await this.aiProxyRouter.route({
      route,
      body: context.request.body,
      query: context.query as { provider?: string; 'tool-name'?: string },
    });
    context.response.status = HttpCode.Ok;
  }
}
