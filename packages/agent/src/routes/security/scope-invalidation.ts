import Router from '@koa/router';
import { Context } from 'koa';
import { HttpCode } from '../../types';
import BaseRoute from '../base-route';

export default class ScopeInvalidation extends BaseRoute {
  override setupPrivateRoutes(router: Router): void {
    router.post(`/scope-cache-invalidation`, this.invalidateCache.bind(this));
  }

  /** Route called when scopes are modified so that we don't have to wait for expiration. */
  private async invalidateCache(ctx: Context): Promise<void> {
    const { renderingId } = ctx.request.body;
    this.services.scope.invalidateCache(renderingId);

    ctx.response.status = HttpCode.NoContent;
  }
}
