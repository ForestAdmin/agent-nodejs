import {
  BusinessError,
  ForbiddenError,
  UnprocessableError,
  ValidationError,
} from '@forestadmin/datasource-toolkit';
import Router from '@koa/router';
import { Context, HttpError, Next } from 'koa';

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
      const status = this.getErrorStatus(e);
      const data = this.getErrorPayload(e);

      context.response.status = status;
      context.response.body = {
        errors: [
          {
            name: this.getErrorName(e),
            detail: this.getErrorMessage(e, context),
            // We needed to maintaining this due to the frontend app/utils/ember-error-util.js
            status,
            ...(data ? { data } : {}),
          },
        ],
      };

      process.nextTick(() => {
        const message =
          this.options.loggerLevel === 'Debug'
            ? ErrorHandling.formatErrorMessage(context, e)
            : e.message; // to avoid leaking sensitive information

        this.options.logger('Error', message, e, context);
      });
    }
  }

  private getErrorStatus(error: Error): number {
    if (error instanceof ValidationError) return HttpCode.BadRequest;
    if (error instanceof ForbiddenError) return HttpCode.Forbidden;
    if (error instanceof UnprocessableError) return HttpCode.Unprocessable;
    if (error instanceof HttpError) return error.status;

    return HttpCode.InternalServerError;
  }

  private getErrorMessage(error: Error, context: Context): string {
    if (error instanceof HttpError || error instanceof BusinessError) {
      return error.message;
    }

    if (this.options.customizeErrorMessage) {
      const message = this.options.customizeErrorMessage(error, context);
      if (message) return message;
    }

    return 'Unexpected error';
  }

  private getErrorName(error: Error): string {
    return error.name || error.constructor.name;
  }

  private getErrorPayload(error: Error & { data: unknown }): unknown {
    if (error instanceof BusinessError) {
      return error.data;
    }

    return null;
  }

  private static formatErrorMessage(context: Context, error: Error): string {
    const { request } = context;

    const query = JSON.stringify(request.query, null, ' ')?.replace(/"/g, '');
    const startException = '\x1b[33m===== An exception was raised =====\x1b[0m';
    const path = `${request.method} \x1b[34m${request.path}\x1b[36m?${query}\x1b[0m`;
    let body = '';

    if (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH') {
      const bodyContent = JSON.stringify(request.body, null, ' ')?.replace(/"/g, '');
      body = `Body \x1b[36m${bodyContent}\x1b[0m`;
    }

    const errorMessage = `\x1b[31m${error.message}\x1b[0m\n\n${error.stack}\n`;
    const message = `${path}\n${body ? `${body}\n` : ''}\n${errorMessage}\n`;
    const endOfException = '\x1b[33m===================================\x1b[0m';

    return `\n${startException}\n${message}${endOfException}\n`;
  }
}
