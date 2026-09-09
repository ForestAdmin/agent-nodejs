import type { BFFConfig } from '../config/env-config';
import type { Middleware } from 'koa';

export const HEALTH_PATH = '/health';

export interface HealthRouteOptions {
  config: BFFConfig;
  version: string;
}

export default function createHealthRoute({ config, version }: HealthRouteOptions): Middleware {
  return async function health(ctx, next) {
    const isHealthRequest =
      (ctx.method === 'GET' || ctx.method === 'HEAD') && ctx.path === HEALTH_PATH;

    if (!isHealthRequest) {
      await next();

      return;
    }

    ctx.status = config.hasAllRequired ? 200 : 503;
    ctx.body = { status: config.hasAllRequired ? 'ok' : 'degraded', version };
  };
}
