import type { Middleware } from 'koa';

export const BFF_VERSION_HEADER = 'X-Forest-Bff-Version';

export default function createVersionHeaderMiddleware(version: string): Middleware {
  return async function versionHeader(ctx, next) {
    ctx.set(BFF_VERSION_HEADER, version);

    await next();
  };
}
