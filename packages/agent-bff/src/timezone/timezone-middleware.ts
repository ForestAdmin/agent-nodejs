import type { Middleware } from 'koa';

import { resolveTimezone } from './timezone';

export const TIMEZONE_HEADER = 'X-Forest-Timezone';

export interface TimezoneMiddlewareOptions {
  defaultTimezone?: string;
}

function bodyTimezone(ctx: Parameters<Middleware>[0]): string | undefined {
  const { body } = ctx.request as { body?: unknown };

  if (typeof body !== 'object' || body === null) return undefined;

  const value = (body as { timezone?: unknown }).timezone;

  return typeof value === 'string' ? value : undefined;
}

export default function createTimezoneMiddleware({
  defaultTimezone,
}: TimezoneMiddlewareOptions): Middleware {
  return async function timezoneMiddleware(ctx, next) {
    ctx.state.timezone = resolveTimezone({
      header: ctx.get(TIMEZONE_HEADER),
      body: bodyTimezone(ctx),
      fallback: defaultTimezone,
    });

    await next();
  };
}
