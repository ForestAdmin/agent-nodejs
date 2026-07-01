import type { BffAccessTokenPayload } from '../oauth/bff-token';
import type { Middleware } from 'koa';

import jsonwebtoken from 'jsonwebtoken';

import { extractBearerToken, resolveAuthMode } from './auth-mode';
import { sessionExpired, unauthorized } from '../http/bff-http-error';
import { BFF_ACCESS_TOKEN_TYPE } from '../oauth/bff-token';

export const BFF_KEY_HEADER = 'X-Forest-Bff-Key';

export interface AuthModeMiddlewareOptions {
  authSecret: string;
}

function verifyBffAccess(token: string, authSecret: string): BffAccessTokenPayload {
  let decoded: unknown;

  try {
    decoded = jsonwebtoken.verify(token, authSecret, { algorithms: ['HS256'] });
  } catch (error) {
    if (error instanceof jsonwebtoken.TokenExpiredError) throw sessionExpired();

    throw unauthorized();
  }

  if (
    typeof decoded !== 'object' ||
    decoded === null ||
    (decoded as { type?: unknown }).type !== BFF_ACCESS_TOKEN_TYPE
  ) {
    throw unauthorized();
  }

  return decoded as BffAccessTokenPayload;
}

export default function createAuthModeMiddleware({
  authSecret,
}: AuthModeMiddlewareOptions): Middleware {
  return async function authModeMiddleware(ctx, next) {
    const bearer = extractBearerToken(ctx.get('Authorization'));
    const apiKey = ctx.get(BFF_KEY_HEADER);

    const mode = resolveAuthMode({ hasBearer: bearer !== undefined, hasApiKey: apiKey !== '' });

    ctx.state.authMode = mode;

    if (mode === 'oauth') {
      ctx.state.principal = verifyBffAccess(bearer as string, authSecret);
    }

    await next();
  };
}
