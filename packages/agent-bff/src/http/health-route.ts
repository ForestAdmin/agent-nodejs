import type { Middleware } from 'koa';

export const HEALTH_PATH = '/health';

/** What the deployment actually serves, and therefore what its configuration switched on. */
export interface HealthFeatures {
  oauth: boolean;
  ai: boolean;
  cors: boolean;
  openapi: boolean;
}

export interface HealthRouteOptions {
  version: string;
  /** Whether everything this deployment needs is configured. Embedded, it always is. */
  healthy: boolean;
  features: HealthFeatures;
}

export default function createHealthRoute({
  version,
  healthy,
  features,
}: HealthRouteOptions): Middleware {
  return async function health(ctx, next) {
    const isHealthRequest =
      (ctx.method === 'GET' || ctx.method === 'HEAD') && ctx.path === HEALTH_PATH;

    if (!isHealthRequest) {
      await next();

      return;
    }

    ctx.status = healthy ? 200 : 503;
    ctx.body = { status: healthy ? 'ok' : 'degraded', version, features };
  };
}
