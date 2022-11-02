import Router from '@koa/router';
import { Context } from 'koa';

import { HttpCode, RouteType } from '../../types';
import BaseRoute from '../base-route';

export default class HealthCheck extends BaseRoute {
  type = RouteType.PublicRoute;

  setupRoutes(router: Router): void {
    router.get('/', this.handleRequest.bind(this));
  }

  public async handleRequest(ctx: Context) {
    ctx.response.body = { error: null, message: 'Agent is running' };
    ctx.response.status = HttpCode.Ok;
  }
}
