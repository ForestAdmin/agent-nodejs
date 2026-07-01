import type { Logger } from '../ports/logger-port';
import type { Middleware } from 'koa';

import { isSerializableError, toErrorBody } from './bff-http-error';

export interface ErrorMiddlewareOptions {
  logger: Logger;
}

function clientErrorStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;

  const { status, statusCode } = error as { status?: unknown; statusCode?: unknown };
  const value = typeof status === 'number' ? status : statusCode;

  return typeof value === 'number' && value >= 400 && value < 500 ? value : undefined;
}

export default function createErrorMiddleware({ logger }: ErrorMiddlewareOptions): Middleware {
  return async function errorMiddleware(ctx, next) {
    try {
      await next();
    } catch (error) {
      if (isSerializableError(error)) {
        if (error.retryAfter !== undefined) ctx.set('Retry-After', String(error.retryAfter));
        ctx.status = error.status;
        ctx.body = toErrorBody(error);

        return;
      }

      const clientStatus = clientErrorStatus(error);

      if (clientStatus !== undefined) {
        ctx.status = clientStatus;
        ctx.body = toErrorBody({
          status: clientStatus,
          type: 'invalid_request',
          message: 'Invalid request',
        });

        return;
      }

      logger('Error', 'Unhandled BFF edge error', {
        cause: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      });
      ctx.status = 500;
      ctx.body = {
        error: { type: 'internal_error', status: 500, message: 'Internal server error' },
      };
    }
  };
}
