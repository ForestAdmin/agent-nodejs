import { Context, HttpError, Next } from 'koa';
import {
  ForbiddenError,
  UnprocessableError,
  ValidationError,
} from '@forestadmin/datasource-toolkit';
import Router from '@koa/router';

import { HttpCode, RouteType } from '../../types';
import BaseRoute from '../base-route';

export default class ErrorHandling extends BaseRoute {
  type = RouteType.ErrorHandler;

  setupRoutes(router: Router): void {
    router.use(this.errorHandler.bind(this));
  }

  private async errorHandler(context: Context, next: Next): Promise<void> {
    try {
      await next();
    } catch (e) {
      let status = e.status || HttpCode.InternalServerError;
      let message = e.message || 'Unexpected error';

      if (
        e instanceof HttpError ||
        e instanceof ValidationError ||
        e instanceof UnprocessableError ||
        e instanceof ForbiddenError
      ) {
        message = e.message;

        switch (true) {
          case e instanceof ValidationError:
            status = HttpCode.BadRequest;
            break;
          case e instanceof ForbiddenError:
            status = HttpCode.Forbidden;
            break;
          case e instanceof UnprocessableError:
            status = HttpCode.Unprocessable;
            break;
          default:
        }
      }

      context.response.status = status;
      context.response.body = { errors: [{ detail: message }] };

      if (!this.options.isProduction) {
        process.nextTick(() => this.debugLogError(context, e));
      }
    }
  }

  private debugLogError(context: Context, error: Error): void {
    const { request } = context;

    const query = JSON.stringify(request.query, null, ' ')?.replace(/"/g, '');
    console.error('');
    console.error(`\x1b[33m===== An exception was raised =====\x1b[0m`);
    console.error(`${request.method} \x1b[34m${request.path}\x1b[36m?${query}\x1b[0m`);

    if (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH') {
      const body = JSON.stringify(request.body, null, ' ')?.replace(/"/g, '');
      console.error('');
      console.error(`Body \x1b[36m${body}\x1b[0m`);
    }

    console.error('');
    console.error('\x1b[31m', error.message, '\x1b[0m');
    console.error('');
    console.error(error.stack);
    console.error(`\x1b[33m===================================\x1b[0m`);
    console.error('');
  }
}
