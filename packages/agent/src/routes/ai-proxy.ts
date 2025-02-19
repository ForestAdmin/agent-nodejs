import { ForestAIProxy, createForestAIProxy } from '@forestadmin/ai-proxy';
import { DataSource } from '@forestadmin/datasource-toolkit';
import Router from '@koa/router';
import { Context } from 'koa';

import BaseRoute from './base-route';
import { ForestAdminHttpDriverServices } from '../services';
import { AgentOptionsWithDefaults, HttpCode, RouteType } from '../types';

export default class AIProxy extends BaseRoute {
  readonly type = RouteType.PrivateRoute;
  private forestProxy: ForestAIProxy;

  constructor(services: ForestAdminHttpDriverServices, options: AgentOptionsWithDefaults) {
    super(services, options);
    this.forestProxy = createForestAIProxy();
  }

  setupRoutes(router: Router): void {
    router.post(`/ai-proxy`, this.proxy.bind(this));
  }

  private async proxy(context: Context) {
    try {
      const { openAIApiKey } = this.options.experimental.ai.openAI;

      if (context.query.provider === 'openai' && openAIApiKey) {
        context.response.body = await this.forestProxy.proxyOpenAI({ openAIApiKey }, context.body);
        context.response.status = HttpCode.Ok;
      } else {
        // TODO add a link to the documentation
        context.throw(HttpCode.BadRequest, 'Provider not supported or API key not set');
      }
    } catch (error) {
      console.error(error);
      context.throw(HttpCode.InternalServerError, 'Error while proxying AI request');
    }

    context.response.status = HttpCode.Ok;
  }
}
