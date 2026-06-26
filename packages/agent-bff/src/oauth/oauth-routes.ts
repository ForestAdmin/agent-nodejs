import type ForestServerClient from './forest-server-client';
import type { ServerTokens } from './forest-server-client';
import type { SessionStore } from './session-store';
import type { Logger } from '../ports/logger-port';
import type { UserInfo } from '@forestadmin/forestadmin-client';
import type { Context, Middleware } from 'koa';

import { BFF_ACCESS_TOKEN_MAX_EXPIRES_IN, issueBffAccessToken } from './bff-token';
import { OAuthExchangeError } from './forest-server-client';
import {
  OAuthRequestError,
  forestIdentityNotAllowed,
  invalidClient,
  invalidGrant,
  invalidRequest,
  toErrorBody,
  unsupportedGrantType,
} from './oauth-error';

export interface OAuthRoutesOptions {
  serverClient: ForestServerClient;
  sessionStore: SessionStore;
  forestAppUrl: string;
  authSecret: string;
  environmentId: number;
  logger: Logger;
}

const AUTHORIZE_REQUIRED_PARAMS = [
  'client_id',
  'redirect_uri',
  'response_type',
  'code_challenge',
  'code_challenge_method',
  'state',
] as const;

const CODE_VERIFIER_PATTERN = /^[A-Za-z0-9\-._~]{43,128}$/;

const SAFE_EXCHANGE_ERRORS = new Set([
  'invalid_request',
  'invalid_client',
  'invalid_grant',
  'unauthorized_client',
  'unsupported_grant_type',
  'invalid_scope',
]);

function getQueryParam(ctx: Context, key: string): string | undefined {
  const value = ctx.query[key];

  if (Array.isArray(value)) {
    throw invalidRequest(`Parameter must appear at most once: ${key}`);
  }

  return value;
}

function requireBodyString(body: Record<string, unknown>, key: string): string {
  const value = body[key];

  if (typeof value !== 'string' || value === '') {
    throw invalidRequest(`Missing required parameter: ${key}`);
  }

  return value;
}

function assertValidCodeVerifier(codeVerifier: string): void {
  if (!CODE_VERIFIER_PATTERN.test(codeVerifier)) {
    throw invalidRequest('code_verifier is malformed');
  }
}

function assertRegisteredRedirectUri(
  redirectUris: string[] | undefined,
  redirectUri: string,
  onMismatch: (message: string) => OAuthRequestError,
): void {
  if (!Array.isArray(redirectUris) || redirectUris.length === 0) {
    throw invalidRequest('Client has no registered redirect_uri');
  }

  if (!redirectUris.includes(redirectUri)) {
    throw onMismatch('redirect_uri does not match the registered client');
  }
}

function toSafeExchangeError(saasError: string): OAuthRequestError {
  if (SAFE_EXCHANGE_ERRORS.has(saasError)) {
    return new OAuthRequestError(400, saasError, 'Authorization code exchange failed');
  }

  return new OAuthRequestError(
    502,
    'server_error',
    'Forest server rejected the authorization code',
  );
}

function mapIdentityError(error: unknown): OAuthRequestError {
  const name = error instanceof Error ? error.name : '';

  if (name === 'ForbiddenError' || name === 'NotFoundError') {
    return forestIdentityNotAllowed('Caller is not an active user for this rendering');
  }

  return new OAuthRequestError(502, 'identity_resolution_failed', 'Failed to resolve identity');
}

async function handleAuthorize(ctx: Context, options: OAuthRoutesOptions): Promise<void> {
  for (const param of AUTHORIZE_REQUIRED_PARAMS) {
    const value = getQueryParam(ctx, param);

    if (value === undefined || value === '') {
      throw invalidRequest(`Missing required parameter: ${param}`);
    }
  }

  const clientId = getQueryParam(ctx, 'client_id') as string;
  const redirectUri = getQueryParam(ctx, 'redirect_uri') as string;
  const responseType = getQueryParam(ctx, 'response_type') as string;
  const codeChallenge = getQueryParam(ctx, 'code_challenge') as string;
  const state = getQueryParam(ctx, 'state') as string;

  if (responseType !== 'code') {
    throw invalidRequest('response_type must be "code"');
  }

  const codeChallengeMethod = getQueryParam(ctx, 'code_challenge_method');

  if (codeChallengeMethod !== 'S256') {
    throw invalidRequest('code_challenge_method must be S256');
  }

  const client = await options.serverClient.getRegisteredClient(clientId);

  if (!client) {
    throw invalidClient('Unknown client_id');
  }

  assertRegisteredRedirectUri(client.redirect_uris, redirectUri, invalidRequest);

  const authorizeUrl = new URL('/oauth/authorize', options.forestAppUrl);
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('code_challenge', codeChallenge);
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('environmentId', String(options.environmentId));

  ctx.redirect(authorizeUrl.toString());
}

function computeExpiresIn(serverTokens: ServerTokens): number {
  const saasRemaining = serverTokens.expiresAt - Math.floor(Date.now() / 1000);

  if (saasRemaining <= 0) {
    throw invalidGrant('The Forest server access token is already expired');
  }

  return Math.min(BFF_ACCESS_TOKEN_MAX_EXPIRES_IN, saasRemaining);
}

interface TokenRequest {
  code: string;
  clientId: string;
  codeVerifier: string;
  redirectUri: string;
}

async function parseTokenRequest(ctx: Context, options: OAuthRoutesOptions): Promise<TokenRequest> {
  const { body } = ctx.request as { body?: unknown };

  if (typeof body !== 'object' || body === null) {
    throw invalidRequest('Missing request body');
  }

  const params = body as Record<string, unknown>;

  if (params.grant_type !== 'authorization_code') {
    throw unsupportedGrantType('Only authorization_code is supported');
  }

  const request: TokenRequest = {
    code: requireBodyString(params, 'code'),
    clientId: requireBodyString(params, 'client_id'),
    codeVerifier: requireBodyString(params, 'code_verifier'),
    redirectUri: requireBodyString(params, 'redirect_uri'),
  };

  assertValidCodeVerifier(request.codeVerifier);

  const client = await options.serverClient.getRegisteredClient(request.clientId);

  if (!client) {
    throw invalidClient('Unknown client_id');
  }

  assertRegisteredRedirectUri(client.redirect_uris, request.redirectUri, invalidGrant);

  return request;
}

async function exchangeForServerTokens(
  request: TokenRequest,
  options: OAuthRoutesOptions,
): Promise<ServerTokens> {
  try {
    return await options.serverClient.exchangeCode(request);
  } catch (error) {
    if (error instanceof OAuthExchangeError) {
      options.logger('Warn', 'Forest server code exchange rejected', { saasError: error.error });
      throw toSafeExchangeError(error.error);
    }

    throw error;
  }
}

async function resolveIdentity(
  serverTokens: ServerTokens,
  options: OAuthRoutesOptions,
): Promise<UserInfo> {
  try {
    return await options.serverClient.getUserInfo(
      serverTokens.renderingId,
      serverTokens.saasAccessToken,
    );
  } catch (error) {
    options.logger('Warn', 'Failed to resolve user info after exchange', {
      renderingId: serverTokens.renderingId,
    });
    throw mapIdentityError(error);
  }
}

async function handleToken(ctx: Context, options: OAuthRoutesOptions): Promise<void> {
  const request = await parseTokenRequest(ctx, options);

  if (!options.sessionStore.claimAuthorizationCode(request.code)) {
    throw invalidGrant('Authorization code has already been used');
  }

  let serverTokens: ServerTokens;
  let expiresInSeconds: number;
  let user: UserInfo;

  try {
    serverTokens = await exchangeForServerTokens(request, options);
    expiresInSeconds = computeExpiresIn(serverTokens);
    user = await resolveIdentity(serverTokens, options);
  } catch (error) {
    // why: a post-claim failure (transient exchange/identity/expiry error) is
    // not a replay; release the local claim so the client can retry the code.
    options.sessionStore.releaseAuthorizationCode(request.code);
    throw error;
  }

  const { sid, refreshToken } = options.sessionStore.create({
    saasAccessToken: serverTokens.saasAccessToken,
    saasRefreshToken: serverTokens.saasRefreshToken,
    renderingId: serverTokens.renderingId,
    userId: user.id,
  });

  const accessToken = issueBffAccessToken({
    sid,
    user,
    renderingId: serverTokens.renderingId,
    authSecret: options.authSecret,
    expiresInSeconds,
  });

  options.logger('Info', 'Issued BFF session token', {
    renderingId: serverTokens.renderingId,
    userId: user.id,
  });

  ctx.status = 200;
  ctx.body = {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: expiresInSeconds,
    refresh_token: refreshToken,
  };
}

type RouteHandler = (ctx: Context, options: OAuthRoutesOptions) => Promise<void>;

function matchRoute(ctx: Context): RouteHandler | undefined {
  if (ctx.method === 'GET' && ctx.path === '/oauth/authorize') return handleAuthorize;
  if (ctx.method === 'POST' && ctx.path === '/oauth/token') return handleToken;

  return undefined;
}

function writeError(ctx: Context, error: unknown, options: OAuthRoutesOptions): void {
  if (error instanceof OAuthRequestError) {
    ctx.status = error.status;
    ctx.body = toErrorBody(error);

    return;
  }

  options.logger('Error', 'OAuth route failure', { path: ctx.path });
  ctx.status = 500;
  ctx.body = { error: { type: 'server_error', status: 500, message: 'OAuth processing failed' } };
}

export default function createOAuthRoutes(options: OAuthRoutesOptions): Middleware {
  return async function oauthRoutes(ctx, next) {
    const handler = matchRoute(ctx);

    if (!handler) {
      await next();

      return;
    }

    try {
      await handler(ctx, options);
    } catch (error) {
      writeError(ctx, error, options);
    }
  };
}
