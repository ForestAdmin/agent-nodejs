import type { Middleware } from 'koa';

export const BFF_VERSION_HEADER = 'X-Forest-Bff-Version';

export const GATEWAY_VERSION_HEADER = 'X-Forest-Gateway-Version';

export default function createVersionHeaderMiddleware(
  version: string,
  gatewayVersion?: string,
): Middleware {
  return async function versionHeader(ctx, next) {
    ctx.set(BFF_VERSION_HEADER, version);
    if (gatewayVersion !== undefined) ctx.set(GATEWAY_VERSION_HEADER, gatewayVersion);

    await next();
  };
}
