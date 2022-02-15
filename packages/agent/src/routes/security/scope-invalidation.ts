import { Context } from 'koa';
import { ValidationError } from '@forestadmin/datasource-toolkit';
import Router from '@koa/router';

import { HttpCode } from '../../types';
import BaseRoute from '../base-route';

export default class ScopeInvalidation extends BaseRoute {
  override setupPrivateRoutes(router: Router): void {
    router.post(`/scope-cache-invalidation`, this.invalidateCache.bind(this));
  }

  /** Route called when scopes are modified so that we don't have to wait for expiration. */
  private async invalidateCache(context: Context): Promise<void> {
    const renderingId = Number(context.request.body?.renderingId);

    if (Number.isNaN(renderingId)) {
      throw new ValidationError('Malformed body');
    }

    this.services.scope.invalidateCache(renderingId);

    context.response.status = HttpCode.NoContent;
  }
}
