import Router from '@koa/router';
import { Context } from 'koa';
import BaseRoute from './base-route';

export default class HealthCheck extends BaseRoute {
  override setupPublicRoutes(router: Router): void {
    router.get('/', this.handleRequest.bind(this));
  }

  public async handleRequest(ctx: Context) {
    ctx.response.body = { error: null, message: 'Agent is running' };
    ctx.response.status = 200;
  }
}
