import type ForestServerClient from './forest-server-client';
import type { ServerTokens } from './forest-server-client';
import type { SessionStore } from './session-store';
import type { Logger } from '../ports/logger-port';
import type { UserInfo } from '@forestadmin/forestadmin-client';
import type { Context, Middleware } from 'koa';

import crypto from 'crypto';
import jsonwebtoken from 'jsonwebtoken';

import { BFF_ACCESS_TOKEN_MAX_EXPIRES_IN, issueBffAccessToken } from './bff-token';
import { OAuthExchangeError } from './forest-server-client';
import {
  OAuthRequestError,
  forestIdentityNotAllowed,
  invalidClient,
  invalidGrant,
  invalidRequest,
  sessionExpired,
  sessionInvalidated,
  toErrorBody,
  unsupportedGrantType,
} from './oauth-error';
import ensureFreshServerAccess from './session-lifecycle';

function hashPresentedToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('base64url');
}

export interface OAuthRoutesOptions {
  serverClient: ForestServerClient;
  sessionStore: SessionStore;
  forestAppUrl: string;
  authSecret: string;
  environmentId: number;
  logger: Logger;
}

const CODE_VERIFIER_PATTERN = /^[A-Za-z0-9\-._~]{43,128}$/;
const S256_CODE_CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

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

  if (name === 'ForbiddenError') {
    return forestIdentityNotAllowed('Caller is not an active user for this rendering');
  }

  return new OAuthRequestError(502, 'identity_resolution_failed', 'Failed to resolve identity');
}

function redirectAuthorizeError(
  ctx: Context,
  redirectUri: string,
  state: string | undefined,
  error: OAuthRequestError,
): void {
  const target = new URL(redirectUri);
  target.searchParams.set('error', error.type);
  target.searchParams.set('error_description', error.message);
  if (state !== undefined && state !== '') target.searchParams.set('state', state);

  ctx.redirect(target.toString());
}

async function handleAuthorize(ctx: Context, options: OAuthRoutesOptions): Promise<void> {
  // Validate client_id and redirect_uri first: until redirect_uri is confirmed
  // against the registered client, errors must not redirect (RFC 6749 §10.15).
  const clientId = getQueryParam(ctx, 'client_id');

  if (clientId === undefined || clientId === '') {
    throw invalidRequest('Missing required parameter: client_id');
  }

  const redirectUri = getQueryParam(ctx, 'redirect_uri');

  if (redirectUri === undefined || redirectUri === '') {
    throw invalidRequest('Missing required parameter: redirect_uri');
  }

  const client = await options.serverClient.getRegisteredClient(clientId);

  if (!client) {
    throw invalidRequest('Unknown client_id');
  }

  assertRegisteredRedirectUri(client.redirect_uris, redirectUri, invalidRequest);

  // redirect_uri is now trusted: remaining validation errors redirect back to
  // the client with error + state (RFC 6749 §4.1.2.1).
  let state: string | undefined;

  try {
    state = getQueryParam(ctx, 'state');
    const responseType = getQueryParam(ctx, 'response_type');

    if (responseType !== 'code') {
      throw invalidRequest('response_type must be "code"');
    }

    if (getQueryParam(ctx, 'code_challenge_method') !== 'S256') {
      throw invalidRequest('code_challenge_method must be S256');
    }

    const codeChallenge = getQueryParam(ctx, 'code_challenge');

    if (codeChallenge === undefined || !S256_CODE_CHALLENGE_PATTERN.test(codeChallenge)) {
      throw invalidRequest('code_challenge is missing or malformed');
    }

    if (state === undefined || state === '') {
      throw invalidRequest('Missing required parameter: state');
    }

    const appBase = new URL(options.forestAppUrl);
    const authorizeUrl = new URL(`${appBase.pathname.replace(/\/$/, '')}/oauth/authorize`, appBase);
    authorizeUrl.searchParams.set('client_id', clientId);
    authorizeUrl.searchParams.set('redirect_uri', redirectUri);
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('code_challenge', codeChallenge);
    authorizeUrl.searchParams.set('code_challenge_method', 'S256');
    authorizeUrl.searchParams.set('state', state);
    authorizeUrl.searchParams.set('environmentId', String(options.environmentId));

    ctx.redirect(authorizeUrl.toString());
  } catch (error) {
    if (error instanceof OAuthRequestError) {
      redirectAuthorizeError(ctx, redirectUri, state, error);

      return;
    }

    throw error;
  }
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

function parseBody(ctx: Context): Record<string, unknown> {
  const { body } = ctx.request as { body?: unknown };

  if (typeof body !== 'object' || body === null) {
    throw invalidRequest('Missing request body');
  }

  return body as Record<string, unknown>;
}

async function parseTokenRequest(ctx: Context, options: OAuthRoutesOptions): Promise<TokenRequest> {
  const params = parseBody(ctx);

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

function isRetriableExchangeError(error: unknown): boolean {
  return !(error instanceof OAuthRequestError) || error.status >= 500;
}

async function resolveIdentity(
  renderingId: number,
  saasAccessToken: string,
  options: OAuthRoutesOptions,
): Promise<UserInfo> {
  try {
    return await options.serverClient.getUserInfo(renderingId, saasAccessToken);
  } catch (error) {
    options.logger('Warn', 'Failed to resolve user info after exchange', { renderingId });
    throw mapIdentityError(error);
  }
}

function writeTokenResponse(
  ctx: Context,
  accessToken: string,
  expiresInSeconds: number,
  refreshToken: string,
): void {
  ctx.set('Cache-Control', 'no-store');
  ctx.set('Pragma', 'no-cache');
  ctx.status = 200;
  ctx.body = {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: expiresInSeconds,
    refresh_token: refreshToken,
  };
}

async function handleAuthorizationCodeGrant(
  ctx: Context,
  options: OAuthRoutesOptions,
): Promise<void> {
  const request = await parseTokenRequest(ctx, options);

  if (!options.sessionStore.claimAuthorizationCode(request.code)) {
    throw invalidGrant('Authorization code has already been used');
  }

  let serverTokens: ServerTokens;

  try {
    serverTokens = await exchangeForServerTokens(request, options);
  } catch (error) {
    if (isRetriableExchangeError(error)) {
      options.sessionStore.releaseAuthorizationCode(request.code);
    }

    throw error;
  }

  const expiresInSeconds = computeExpiresIn(serverTokens);
  const user = await resolveIdentity(
    serverTokens.renderingId,
    serverTokens.saasAccessToken,
    options,
  );

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

  writeTokenResponse(ctx, accessToken, expiresInSeconds, refreshToken);
}

function expiresInFromAccessToken(saasAccessToken: string): number {
  const decoded = jsonwebtoken.decode(saasAccessToken) as { exp?: number } | null;
  const saasRemaining = (decoded?.exp ?? 0) - Math.floor(Date.now() / 1000);

  if (saasRemaining <= 0) {
    throw sessionExpired('The Forest server access token is already expired');
  }

  return Math.min(BFF_ACCESS_TOKEN_MAX_EXPIRES_IN, saasRemaining);
}

const inFlightRefreshByPresentedHash = new Map<string, Promise<RefreshGrantResult>>();

interface RefreshGrantResult {
  sid: string;
  accessToken: string;
  expiresInSeconds: number;
  newRefreshToken: string;
}

async function reissueThenCommitRotation(
  presentedToken: string,
  sid: string,
  renderingId: number,
  newRefreshToken: string,
  options: OAuthRoutesOptions,
): Promise<RefreshGrantResult> {
  // Refresh the SaaS access token and resolve identity BEFORE committing the
  // rotation. If any of this fails, the presented refresh token stays valid so
  // a transient blip does not brick the session.
  const saasAccessToken = await ensureFreshServerAccess({
    sid,
    store: options.sessionStore,
    serverClient: options.serverClient,
  });

  const expiresInSeconds = expiresInFromAccessToken(saasAccessToken);
  const user = await resolveIdentity(renderingId, saasAccessToken, options);

  if (!options.sessionStore.commitRotation(presentedToken, newRefreshToken)) {
    throw sessionExpired('Session expired during refresh');
  }

  const accessToken = issueBffAccessToken({
    sid,
    user,
    renderingId,
    authSecret: options.authSecret,
    expiresInSeconds,
  });

  return { sid, accessToken, expiresInSeconds, newRefreshToken };
}

async function handleRefreshGrant(ctx: Context, options: OAuthRoutesOptions): Promise<void> {
  const params = parseBody(ctx);
  const presentedToken = requireBodyString(params, 'refresh_token');
  const presentedHash = hashPresentedToken(presentedToken);

  let pending = inFlightRefreshByPresentedHash.get(presentedHash);

  if (!pending) {
    const rotation = options.sessionStore.prepareRotation(presentedToken);

    if (rotation.outcome === 'reuse') {
      options.sessionStore.destroy(rotation.sid);
      options.logger('Warn', 'Rotated-out refresh token replayed; session invalidated', {
        sid: rotation.sid,
      });
      throw sessionInvalidated('Refresh token was already used; the session is invalidated');
    }

    if (rotation.outcome === 'unknown') {
      throw invalidGrant('Unknown or malformed refresh token');
    }

    pending = reissueThenCommitRotation(
      presentedToken,
      rotation.sid,
      rotation.renderingId,
      rotation.newRefreshToken,
      options,
    ).finally(() => {
      inFlightRefreshByPresentedHash.delete(presentedHash);
    });
    inFlightRefreshByPresentedHash.set(presentedHash, pending);
  }

  const result = await pending;

  options.logger('Info', 'Refreshed BFF session token', { sid: result.sid });
  writeTokenResponse(ctx, result.accessToken, result.expiresInSeconds, result.newRefreshToken);
}

async function handleToken(ctx: Context, options: OAuthRoutesOptions): Promise<void> {
  const params = parseBody(ctx);

  if (params.grant_type === 'refresh_token') {
    await handleRefreshGrant(ctx, options);

    return;
  }

  if (params.grant_type === 'authorization_code') {
    await handleAuthorizationCodeGrant(ctx, options);

    return;
  }

  throw unsupportedGrantType('Only authorization_code and refresh_token are supported');
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

  options.logger('Error', 'OAuth route failure', {
    path: ctx.path,
    cause: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
  });
  ctx.status = 500;
  ctx.body = { error: 'server_error', error_description: 'OAuth processing failed' };
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
