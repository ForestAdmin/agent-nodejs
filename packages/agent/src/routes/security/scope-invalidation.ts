import { ValidationError } from '@forestadmin/datasource-toolkit';
import Router from '@koa/router';
import { Context } from 'koa';

import { HttpCode, RouteType } from '../../types';
import BaseRoute from '../base-route';

export default class ScopeInvalidation extends BaseRoute {
  readonly type = RouteType.PrivateRoute;

  setupRoutes(router: Router): void {
    router.post(`/scope-cache-invalidation`, this.invalidateCache.bind(this));
  }

  /** Route called when scopes are modified so that we don't have to wait for expiration. */
  private async invalidateCache(context: Context): Promise<void> {
    const renderingId = Number(context.request.body?.renderingId);

    if (Number.isNaN(renderingId)) {
      throw new ValidationError('Malformed body');
    }

    this.services.authorization.invalidateScopeCache(renderingId);

    context.response.status = HttpCode.NoContent;
  }
}
