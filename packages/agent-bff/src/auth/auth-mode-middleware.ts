import type { BffAccessTokenPayload } from '../oauth/bff-token';
import type { Middleware } from 'koa';

import jsonwebtoken from 'jsonwebtoken';

import { extractBearerToken, resolveAuthMode } from './auth-mode';
import { issueAgentTokenFromPrincipal } from '../api-key/agent-token';
import { readApiKey } from '../api-key/api-key-middleware';
import { sessionExpired, unauthorized } from '../http/bff-http-error';
import { BFF_ACCESS_TOKEN_TYPE } from '../oauth/bff-token';

export interface AuthModeMiddlewareOptions {
  authSecret: string;
  /** Verifies the `bff_access` bearers; absent when OAuth is off, which refuses every bearer. */
  accessTokenKey?: Buffer;
}

function decodeWithKey(token: string, key: string | Buffer): unknown {
  // The signature is checked but not the expiry, so the token type is checked first: a wrong-typed
  // token must be `unauthorized`, and only an expired `bff_access` maps to `session_expired`.
  try {
    return jsonwebtoken.verify(token, key, { algorithms: ['HS256'], ignoreExpiration: true });
  } catch {
    return undefined;
  }
}

function isBffAccess(decoded: unknown): decoded is BffAccessTokenPayload {
  return (
    typeof decoded === 'object' &&
    decoded !== null &&
    (decoded as { type?: unknown }).type === BFF_ACCESS_TOKEN_TYPE
  );
}

function verifyBffAccess(
  token: string,
  { authSecret, accessTokenKey }: AuthModeMiddlewareOptions,
): BffAccessTokenPayload {
  if (!accessTokenKey) throw unauthorized();

  const decoded = decodeWithKey(token, accessTokenKey);

  if (!isBffAccess(decoded)) {
    // A `bff_access` signed with the previous key: the client refreshes to get one under the current key.
    if (isBffAccess(decodeWithKey(token, authSecret))) throw sessionExpired();

    throw unauthorized();
  }

  const { exp } = decoded as { exp?: unknown };

  if (typeof exp !== 'number') {
    throw unauthorized();
  }

  if (exp * 1000 <= Date.now()) {
    throw sessionExpired();
  }

  return decoded;
}

export default function createAuthModeMiddleware(options: AuthModeMiddlewareOptions): Middleware {
  const { authSecret } = options;

  return async function authModeMiddleware(ctx, next) {
    const bearer = extractBearerToken(ctx.get('Authorization'));
    const apiKey = readApiKey(ctx);

    const mode = resolveAuthMode({ hasBearer: bearer !== undefined, hasApiKey: apiKey !== '' });

    ctx.state.authMode = mode;

    if (mode === 'oauth') {
      const principal = verifyBffAccess(bearer as string, options);
      ctx.state.principal = principal;
      ctx.state.agentToken = issueAgentTokenFromPrincipal({ principal, authSecret });
      ctx.set('Cache-Control', 'no-store');
    }

    await next();
  };
}
