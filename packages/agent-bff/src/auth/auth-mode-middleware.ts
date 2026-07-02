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

  // Verify the signature first but ignore expiration, so the token type can be
  // checked before expiry: a wrong-typed token must be `unauthorized`, and only
  // a genuine expired `bff_access` should map to `session_expired`.
  try {
    decoded = jsonwebtoken.verify(token, authSecret, {
      algorithms: ['HS256'],
      ignoreExpiration: true,
    });
  } catch {
    throw unauthorized();
  }

  if (
    typeof decoded !== 'object' ||
    decoded === null ||
    (decoded as { type?: unknown }).type !== BFF_ACCESS_TOKEN_TYPE
  ) {
    throw unauthorized();
  }

  const { exp } = decoded as { exp?: unknown };

  if (typeof exp === 'number' && exp * 1000 <= Date.now()) {
    throw sessionExpired();
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
