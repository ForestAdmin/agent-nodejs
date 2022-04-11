import { Context, Next } from 'koa';
import Router from '@koa/router';

import { LoggerLevel } from '@forestadmin/datasource-toolkit';

import { HttpCode, RouteType } from '../../types';
import BaseRoute from '../base-route';

export default class Logger extends BaseRoute {
  type = RouteType.Logger;

  setupRoutes(router: Router): void {
    router.use(this.logger.bind(this));
  }

  private async logger(context: Context, next: Next): Promise<void> {
    const timer = Date.now();

    try {
      await next();
    } finally {
      let logLevel: LoggerLevel = 'info';
      if (context.response.status >= HttpCode.BadRequest) logLevel = 'warn';
      if (context.response.status >= HttpCode.InternalServerError) logLevel = 'error';

      let message = `[${context.response.status}]`;
      message += ` ${context.request.method} ${context.request.path}`;
      message += ` - ${Date.now() - timer}ms`;

      this.options?.logger(logLevel, message);
    }
  }
}
