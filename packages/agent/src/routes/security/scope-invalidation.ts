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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = context.request.body as any;
    const renderingId = Number(body?.renderingId);

    if (Number.isNaN(renderingId)) {
      throw new ValidationError('Malformed body');
    }

    this.services.authorization.invalidateScopeCache(renderingId);

    context.response.status = HttpCode.NoContent;
  }
}
