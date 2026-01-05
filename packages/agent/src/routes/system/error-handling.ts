import type Router from '@koa/router';
import type { Context, Next } from 'koa';

import {
  BadRequestError,
  BusinessError,
  ForbiddenError,
  NotFoundError,
  UnprocessableError,
  ValidationError,
} from '@forestadmin/datasource-toolkit';
import { HttpError } from 'koa';

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
            detail: this.getErrorMessage(e),
            // We needed to maintaining this due to the frontend app/utils/ember-error-util.js
            status,
            ...(data ? { data } : {}),
          },
        ],
      };

      if (!this.options.isProduction) {
        process.nextTick(() => this.debugLogError(context, e));
      }

      // The error will be used by Logger
      throw e;
    }
  }

  private getErrorStatus(error: Error): number {
    if (error instanceof HttpError) return error.status;

    switch (true) {
      case error instanceof ValidationError:
      case BusinessError.isOfType(error, ValidationError):
      case error instanceof BadRequestError:
      case BusinessError.isOfType(error, BadRequestError):
        return HttpCode.BadRequest;

      case error instanceof ForbiddenError:
      case BusinessError.isOfType(error, ForbiddenError):
        return HttpCode.Forbidden;

      case error instanceof NotFoundError:
      case BusinessError.isOfType(error, NotFoundError):
        return HttpCode.NotFound;

      case error instanceof UnprocessableError:
      case BusinessError.isOfType(error, UnprocessableError):
      case error instanceof BusinessError:
      case BusinessError.isOfType(error, BusinessError):
        return HttpCode.Unprocessable;

      default:
        return HttpCode.InternalServerError;
    }
  }

  private getErrorMessage(error: Error): string {
    if (this.options.customizeErrorMessage) {
      const message = this.options.customizeErrorMessage(error);
      if (message) return message;
    }

    if (
      (error instanceof HttpError ||
        error instanceof BusinessError ||
        (error as BusinessError).isBusinessError) &&
      error.message
    ) {
      return error.message;
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
