import type AiProxyClient from './ai-proxy-client';
import type { AiProxyResponse } from './ai-proxy-client';
import type { BffAccessTokenPayload } from '../oauth/bff-token';
import type ForestServerClient from '../oauth/forest-server-client';
import type { SessionStore } from '../oauth/session-store';
import type { Logger } from '../ports/logger-port';
import type { Context, Middleware } from 'koa';

import { AiProxyTimeoutError } from './ai-proxy-client';
import { unauthorized } from '../http/bff-http-error';
import {
  oauthRequired,
  upstreamError,
  upstreamTimeout,
  upstreamUnreachable,
} from '../http/bff-local-errors';
import { OAuthRequestError } from '../oauth/oauth-error';
import ensureFreshServerAccess from '../oauth/session-lifecycle';

export const AI_QUERY_ROUTE = '/agent/v1/ai/query';

const POSITIVE_INTEGER = /^[1-9]\d*$/;

export interface AiRoutesMiddlewareOptions {
  client: AiProxyClient;
  sessionStore: SessionStore;
  serverClient: ForestServerClient;
  environmentId?: number;
  logger: Logger;
}

function requireSessionPrincipal(ctx: Context): BffAccessTokenPayload {
  if (ctx.state.authMode === 'api-key') throw oauthRequired();

  const principal = ctx.state.principal as BffAccessTokenPayload | undefined;
  if (!principal) throw unauthorized('No session for this request');

  return principal;
}

function requireRenderingId(principal: BffAccessTokenPayload): number {
  if (!POSITIVE_INTEGER.test(String(principal.rendering_id))) {
    throw unauthorized('The session carries no usable rendering');
  }

  return Number(principal.rendering_id);
}

async function resolveSessionAccessToken(
  principal: BffAccessTokenPayload,
  store: SessionStore,
  serverClient: ForestServerClient,
): Promise<string> {
  try {
    return await ensureFreshServerAccess({ sid: principal.sid, store, serverClient });
  } catch (error) {
    if (error instanceof OAuthRequestError && error.status >= 500) throw upstreamUnreachable();

    throw error;
  }
}

function relayJsonBodyOrGenericError(
  ctx: Context,
  response: AiProxyResponse,
  logger: Logger,
): void {
  const bodyWouldLeakInfrastructure = response.status >= 500 || !response.isJson;

  if (bodyWouldLeakInfrastructure) {
    logger('Warn', 'AI proxy upstream body withheld; client message is generic', {
      status: response.status,
      isJson: response.isJson,
    });

    throw upstreamError(response.status);
  }

  ctx.status = response.status;
  ctx.body = response.body;
}

export default function createAiRoutesMiddleware({
  client,
  sessionStore,
  serverClient,
  environmentId,
  logger,
}: AiRoutesMiddlewareOptions): Middleware {
  return async function aiRoutesMiddleware(ctx, next) {
    if (ctx.path !== AI_QUERY_ROUTE || ctx.method !== 'POST') {
      await next();

      return;
    }

    const principal = requireSessionPrincipal(ctx);
    const renderingId = requireRenderingId(principal);

    const saasAccessToken = await resolveSessionAccessToken(principal, sessionStore, serverClient);

    let response: AiProxyResponse;

    try {
      response = await client.query({
        saasAccessToken,
        environmentId,
        renderingId,
        body: ctx.request.body,
      });
    } catch (error) {
      if (error instanceof AiProxyTimeoutError) throw upstreamTimeout();
      throw upstreamUnreachable();
    }

    relayJsonBodyOrGenericError(ctx, response, logger);
  };
}
