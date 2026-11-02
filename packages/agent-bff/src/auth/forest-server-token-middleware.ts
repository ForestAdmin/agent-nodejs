import type { ResolvedApiKeyIdentity } from '../api-key/api-key-client';
import type { BffAccessTokenPayload } from '../oauth/bff-token';
import type { SessionTokenCodec } from '../oauth/session-token';
import type { Logger } from '../ports/logger-port';
import type { Context, Middleware } from 'koa';

import { readRenderingId } from './auth-mode';
import { extractErrorMessage } from '../errors';
import { sessionExpired } from '../http/bff-http-error';
import { auditUnavailable } from '../http/bff-local-errors';
import resolveServerAccess from '../oauth/server-access';

export type ForestServerTokenResolver = () => Promise<string>;

export interface OAuthSessionAccess {
  sessionTokens: SessionTokenCodec;
}

export interface ForestServerTokenMiddlewareOptions {
  session?: OAuthSessionAccess;
  logger: Logger;
}

const NO_SESSION_MESSAGE = 'The session behind this request could not be resolved';
const NO_RESOLVER_MESSAGE = 'This request carries no Forest server credentials';
/**
 * Carries no `Retry-After`: the key resolution came back without an audit credential at all — a
 * Forest server that does not mint one yet — so no retry can succeed until that server ships it.
 */
const NO_AUDIT_CREDENTIAL_MESSAGE =
  'The Forest server does not provide the credential the activity log is written with, so the ' +
  'operation was not performed';

function toSessionAccessFailure(
  error: unknown,
  principal: BffAccessTokenPayload,
  logger: Logger,
): Error {
  logger('Warn', 'Could not resolve the Forest server access of this session', {
    renderingId: readRenderingId(principal),
    cause: extractErrorMessage(error),
  });

  return sessionExpired(NO_SESSION_MESSAGE);
}

async function resolveToken(
  ctx: Context,
  logger: Logger,
  session?: OAuthSessionAccess,
): Promise<string> {
  if (ctx.state.authMode === 'api-key') {
    const token = ctx.state.forestServerToken as string | undefined;

    if (!token) throw auditUnavailable(undefined, NO_AUDIT_CREDENTIAL_MESSAGE);

    return token;
  }

  const principal = ctx.state.principal as BffAccessTokenPayload | undefined;

  if (!principal || !session) throw sessionExpired(NO_SESSION_MESSAGE);

  try {
    return resolveServerAccess(principal, session.sessionTokens);
  } catch (error) {
    throw toSessionAccessFailure(error, principal, logger);
  }
}

/**
 * Lands a lazy resolver of the Forest server bearer on the context, for both auth modes. Lazy on
 * purpose: the routes that audit nothing — /health, the permissions, context, OpenAPI and docs
 * routes — must not pay a session lookup, and the permissions one is hit on every page load.
 *
 * Keeping both modes here is what lets the data and action routes read one function off the context
 * instead of taking the session store and the Forest server client as dependencies.
 */
export default function createForestServerTokenMiddleware({
  session,
  logger,
}: ForestServerTokenMiddlewareOptions): Middleware {
  return async function forestServerTokenMiddleware(ctx, next) {
    let pending: Promise<string> | undefined;

    const resolver: ForestServerTokenResolver = () => {
      pending ??= resolveToken(ctx, logger, session);

      return pending;
    };

    ctx.state.resolveForestServerToken = resolver;

    await next();
  };
}

export function resolveForestServerToken(ctx: Context): Promise<string> {
  const resolver = ctx.state.resolveForestServerToken as ForestServerTokenResolver | undefined;

  if (!resolver) throw sessionExpired(NO_RESOLVER_MESSAGE);

  return resolver();
}

export function resolveRenderingId(ctx: Context): number | undefined {
  if (ctx.state.authMode === 'api-key') {
    return (ctx.state.apiKeyIdentity as ResolvedApiKeyIdentity | undefined)?.renderingId;
  }

  const principal = ctx.state.principal as BffAccessTokenPayload | undefined;

  return principal ? readRenderingId(principal) : undefined;
}
