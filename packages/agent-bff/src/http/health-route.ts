import type { Middleware } from 'koa';

export const HEALTH_PATH = '/health';

/**
 * Which optional surfaces this deployment was CONFIGURED to serve. Deliberately not a statement
 * that they work: OAuth is `true` as soon as an encryption key is set, whether or not the Forest
 * server ever answers. Naming it `configured` is the whole point — a reader who takes `oauth: true`
 * for "OAuth is functional" will believe a misconfigured deployment is healthy.
 */
export interface HealthConfigured {
  oauth: boolean;
  ai: boolean;
  cors: boolean;
  openapi: boolean;
}

export interface HealthRouteOptions {
  version: string;
  /** Whether everything this deployment needs is configured. Embedded, it always is. */
  healthy: boolean;
  configured: HealthConfigured;
}

export default function createHealthRoute({
  version,
  healthy,
  configured,
}: HealthRouteOptions): Middleware {
  return async function health(ctx, next) {
    const isHealthRequest =
      (ctx.method === 'GET' || ctx.method === 'HEAD') && ctx.path === HEALTH_PATH;

    if (!isHealthRequest) {
      await next();

      return;
    }

    ctx.status = healthy ? 200 : 503;
    ctx.body = { status: healthy ? 'ok' : 'degraded', version, configured };
  };
}
