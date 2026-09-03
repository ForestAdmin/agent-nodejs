import type AiProxyClient from './ai-proxy-client';
import type { AiProxyResponse } from './ai-proxy-client';
import type { BffAccessTokenPayload } from '../oauth/bff-token';
import type { EnvironmentIdResolver } from '../oauth/environment-id';
import type ForestServerClient from '../oauth/forest-server-client';
import type { SessionStore } from '../oauth/session-store';
import type { Logger } from '../ports/logger-port';
import type { Context, Middleware } from 'koa';

import { AiProxyTimeoutError } from './ai-proxy-client';
import { requireRenderingId } from '../auth/auth-mode';
import { unauthorized } from '../http/bff-http-error';
import {
  environmentUnresolved,
  oauthRequired,
  upstreamError,
  upstreamTimeout,
  upstreamUnreachable,
} from '../http/bff-local-errors';
import { environmentFailureLevel } from '../oauth/environment-fetch-error';
import { OAuthRequestError } from '../oauth/oauth-error';
import ensureFreshServerAccess from '../oauth/session-lifecycle';

export const AI_QUERY_ROUTE = '/agent/v1/ai/query';

const JSON_CONTENT_TYPE = 'application/json';
const MAX_CAUSE_DEPTH = 3;
const MAX_CAUSE_MESSAGE = 512;

export interface AiRoutesMiddlewareOptions {
  client: AiProxyClient;
  sessionStore: SessionStore;
  serverClient: ForestServerClient;
  resolveEnvironmentId?: EnvironmentIdResolver;
  logger: Logger;
}

function requireSessionPrincipal(ctx: Context): BffAccessTokenPayload {
  if (ctx.state.authMode === 'api-key') throw oauthRequired();

  const principal = ctx.state.principal as BffAccessTokenPayload | undefined;
  if (!principal) throw unauthorized('No session for this request');

  return principal;
}

function clamp(message: string): string {
  return message.length > MAX_CAUSE_MESSAGE ? `${message.slice(0, MAX_CAUSE_MESSAGE)}…` : message;
}

function describeFailure(error: unknown, depthLeft = MAX_CAUSE_DEPTH): string {
  if (!(error instanceof Error)) return clamp(String(error));

  const { cause } = error as { cause?: unknown };
  const walkable = depthLeft > 0 && cause !== undefined;
  const tail = walkable ? ` (cause: ${describeFailure(cause, depthLeft - 1)})` : '';

  return `${error.name}: ${clamp(error.message)}${tail}`;
}

/**
 * Resolved outside the `try` that maps AI proxy failures: a Forest server refusing the environment
 * read is not the AI proxy being unreachable, and telling the operator otherwise sends them
 * debugging a component that was never contacted.
 */
async function resolveEnvironmentIdOrRefuse(
  resolveEnvironmentId: EnvironmentIdResolver | undefined,
  logger: Logger,
): Promise<number | undefined> {
  if (!resolveEnvironmentId) return undefined;

  try {
    return await resolveEnvironmentId();
  } catch (error) {
    logger(
      environmentFailureLevel(error),
      'AI query refused: the Forest environment id could not be resolved',
      { cause: describeFailure(error) },
    );

    if (error instanceof Error && error.name === 'TimeoutError') throw upstreamTimeout();

    throw environmentUnresolved();
  }
}

async function resolveSessionAccessToken(
  principal: BffAccessTokenPayload,
  store: SessionStore,
  serverClient: ForestServerClient,
  logger: Logger,
): Promise<string> {
  try {
    return await ensureFreshServerAccess({ sid: principal.sid, store, serverClient });
  } catch (error) {
    if (error instanceof OAuthRequestError && error.status >= 500) {
      logger('Warn', 'AI query refused: the Forest server could not refresh the session', {
        cause: describeFailure(error),
      });

      throw upstreamUnreachable();
    }

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
      ...(response.unparseableBodyError !== undefined
        ? { cause: describeFailure(response.unparseableBodyError) }
        : {}),
    });

    throw upstreamError(response.status);
  }

  ctx.status = response.status;
  ctx.type = JSON_CONTENT_TYPE;
  ctx.body = JSON.stringify(response.body);
}

export default function createAiRoutesMiddleware({
  client,
  sessionStore,
  serverClient,
  resolveEnvironmentId,
  logger,
}: AiRoutesMiddlewareOptions): Middleware {
  return async function aiRoutesMiddleware(ctx, next) {
    if (ctx.path !== AI_QUERY_ROUTE || ctx.method !== 'POST') {
      await next();

      return;
    }

    const principal = requireSessionPrincipal(ctx);
    const renderingId = requireRenderingId(principal);

    const saasAccessToken = await resolveSessionAccessToken(
      principal,
      sessionStore,
      serverClient,
      logger,
    );

    const environmentId = await resolveEnvironmentIdOrRefuse(resolveEnvironmentId, logger);

    let response: AiProxyResponse;

    try {
      response = await client.query({
        saasAccessToken,
        environmentId,
        renderingId,
        body: ctx.request.body,
      });
    } catch (error) {
      logger('Warn', 'AI query failed against the Forest server', {
        cause: describeFailure(error),
      });

      if (error instanceof AiProxyTimeoutError) throw upstreamTimeout();

      throw upstreamUnreachable();
    }

    relayJsonBodyOrGenericError(ctx, response, logger);
  };
}
