import type { ResolvedApiKeyIdentity } from '../api-key/api-key-client';
import type { BffAccessTokenPayload } from '../oauth/bff-token';
import type ForestServerClient from '../oauth/forest-server-client';
import type { SessionStore } from '../oauth/session-store';
import type { Context, Middleware } from 'koa';

import { readRenderingId } from './auth-mode';
import { sessionExpired } from '../http/bff-http-error';
import { AUDIT_RETRY_AFTER_SECONDS, auditUnavailable } from '../http/bff-local-errors';
import { OAuthRequestError } from '../oauth/oauth-error';
import ensureFreshServerAccess from '../oauth/session-lifecycle';

export type ForestServerTokenResolver = () => Promise<string>;

export interface OAuthSessionAccess {
  store: SessionStore;
  serverClient: ForestServerClient;
}

export interface ForestServerTokenMiddlewareOptions {
  session?: OAuthSessionAccess;
}

const NO_SESSION_MESSAGE = 'The session behind this request could not be resolved';
const NO_RESOLVER_MESSAGE = 'This request carries no Forest server credentials';
const UNAUTHORIZED = 401;

async function resolveToken(ctx: Context, session?: OAuthSessionAccess): Promise<string> {
  if (ctx.state.authMode === 'api-key') {
    const token = ctx.state.forestServerToken as string | undefined;

    if (!token) throw auditUnavailable(AUDIT_RETRY_AFTER_SECONDS);

    return token;
  }

  const principal = ctx.state.principal as BffAccessTokenPayload | undefined;

  if (!principal || !session) throw sessionExpired(NO_SESSION_MESSAGE);

  try {
    return await ensureFreshServerAccess({
      sid: principal.sid,
      store: session.store,
      serverClient: session.serverClient,
    });
  } catch (error) {
    // Only a session the Forest server rejected, or one that vanished, makes re-authenticating the
    // answer. Everything else — the server being unreachable, above all — is retryable, and a 401
    // would log every user out over a blip instead of failing the audit write alone.
    if (error instanceof OAuthRequestError && error.status === UNAUTHORIZED) {
      throw sessionExpired(NO_SESSION_MESSAGE);
    }

    throw auditUnavailable(AUDIT_RETRY_AFTER_SECONDS);
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
}: ForestServerTokenMiddlewareOptions): Middleware {
  return async function forestServerTokenMiddleware(ctx, next) {
    let pending: Promise<string> | undefined;

    const resolver: ForestServerTokenResolver = () => {
      pending ??= resolveToken(ctx, session);

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
