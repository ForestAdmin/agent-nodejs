import { Context, Next } from 'koa';
import Router from '@koa/router';

import { HttpCode, LoggerLevel, RouteType } from '../../types';
import BaseRoute from '../base-route';

export default class Logger extends BaseRoute {
  type = RouteType.PublicMiddleware;

  setupRoutes(router: Router): void {
    router.use(this.logger.bind(this));
  }

  /* istanbul ignore next */
  private async logger(context: Context, next: Next): Promise<void> {
    const timer = Date.now();

    try {
      await next();
    } finally {
      let message = `[${context.response.status}]`;
      message += ` ${context.request.method} ${context.request.path}`;
      message += ` - ${Date.now() - timer}ms`;

      this.options?.logger(
        context.response.status >= HttpCode.BadRequest ? LoggerLevel.Warn : LoggerLevel.Info,
        message,
      );
    }
  }
}
