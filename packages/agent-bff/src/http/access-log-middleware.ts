import type { Logger, LoggerLevel } from '../ports/logger-port';
import type { Middleware } from 'koa';

import { emittedBaseOf } from '../base-path';

export interface AccessLogMiddlewareOptions {
  logger: Logger;
  /** Prefix the host serves this BFF under, so the line names a url the caller can actually call. */
  basePath: string;
}

const CLIENT_ERROR = 400;
const SERVER_ERROR = 500;

function levelOf(status: number): LoggerLevel {
  if (status >= SERVER_ERROR) return 'Error';
  if (status >= CLIENT_ERROR) return 'Warn';

  return 'Info';
}

/**
 * The status the caller will see, read off an exception rather than off the response: this
 * middleware sits above every error handler the BFF has, so at the moment it logs, `ctx.status` is
 * still the 404 Koa defaults to and would name a status nobody was ever answered.
 */
function statusOf(error: unknown): number {
  if (typeof error !== 'object' || error === null) return SERVER_ERROR;

  const { status, statusCode } = error as { status?: unknown; statusCode?: unknown };
  const value = typeof status === 'number' ? status : statusCode;

  return typeof value === 'number' ? value : SERVER_ERROR;
}

/**
 * One line per request, in the shape the agent's own request logger emits (`[200] GET /path - 12ms`)
 * so both layers read the same way in an embedded deployment.
 *
 * Belongs at the head of the chain: everything below it — `/health`, `/docs`, `/oauth/*`, a 401 from
 * the auth edge, a rejected origin — either never reaches the agent or never reaches the
 * agent-scoped error middleware, and is exactly the traffic that used to leave no trace at all.
 *
 * The query string is deliberately absent. Nothing routed today needs it, and a line that carries it
 * would leak whatever a future route accepts there without anyone revisiting this decision.
 *
 * Carries no cause either, so that a host logger which cannot take structured fields still reads as
 * one line per request. The detail is not lost where it matters: `createErrorMiddleware` already
 * reports it for everything under `/agent`. Outside it — a body parser rejection on an OAuth POST is
 * the only route there today — the stack reaches stderr through Koa's own handler, as it did before
 * this middleware existed.
 */
export default function createAccessLogMiddleware({
  logger,
  basePath,
}: AccessLogMiddlewareOptions): Middleware {
  return async function accessLog(ctx, next) {
    const startedAt = Date.now();

    const write = (status: number) => {
      const path = `${emittedBaseOf(ctx, basePath)}${ctx.path}`;

      try {
        logger(levelOf(status), `[${status}] ${ctx.method} ${path} - ${Date.now() - startedAt}ms`);
      } catch {
        // The logger belongs to the host and nothing in the port forbids it from throwing. Left
        // unguarded, a throw here would answer 500 to a request the route served, and on the error
        // path it would replace the exception being reported with its own. There is nowhere to
        // report this: the only sink available is the logger that just failed.
      }
    };

    try {
      await next();
    } catch (error) {
      write(statusOf(error));

      throw error;
    }

    write(ctx.response.status);
  };
}
