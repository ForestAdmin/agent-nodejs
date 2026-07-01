export { default as BFFHttpServer } from './http/bff-http-server';
export { parseConfig, REQUIRED_KEYS } from './config/env-config';
export type { BFFConfig, PresenceMap, RequiredKey } from './config/env-config';
export { default as runCli } from './cli-core';
export { ConfigurationError } from './errors';
export { default as DEFAULT_BFF_PORT } from './defaults';
export { default as createConsoleLogger } from './adapters/console-logger';
export type { Logger, LoggerLevel } from './ports/logger-port';
export { default as version } from './version';
export { default as ForestServerClient, OAuthExchangeError } from './oauth/forest-server-client';
export type {
  ServerTokens,
  RegisteredClient,
  ExchangeCodeParams,
} from './oauth/forest-server-client';
export { default as createOAuthRoutes } from './oauth/oauth-routes';
export { default as createInMemorySessionStore } from './oauth/session-store';
export type { SessionStore, StoredSession, CreatedSession } from './oauth/session-store';
export { default as createTokenCipher } from './oauth/token-cipher';
export { default as ensureFreshServerAccess } from './oauth/session-lifecycle';
export { issueBffAccessToken, BFF_ACCESS_TOKEN_TYPE } from './oauth/bff-token';
export type { BffAccessTokenPayload } from './oauth/bff-token';
export { createPkcePair } from './oauth/pkce';
export { OAuthRequestError } from './oauth/oauth-error';
export { parseApiKey, hashApiKey, fingerprintApiKey } from './api-key/api-key';
export type { ParsedApiKey } from './api-key/api-key';
export { issueAgentToken, AGENT_TOKEN_EXPIRES_IN } from './api-key/agent-token';
export { default as ApiKeyClient, ApiKeyResolveError } from './api-key/api-key-client';
export type {
  ResolvedApiKeyIdentity,
  ApiKeyIdentityUser,
  ApiKeyClientOptions,
} from './api-key/api-key-client';
export { default as createResolveCache } from './api-key/resolve-cache';
export type { ResolveCache, ResolveCacheOptions } from './api-key/resolve-cache';
export { default as createApiKeyAuthenticator } from './api-key/api-key-authenticator';
export type {
  ApiKeyAuthenticator,
  AuthenticatedApiKey,
  ApiKeyAuthenticatorOptions,
} from './api-key/api-key-authenticator';
export { default as createApiKeyMiddleware, BFF_KEY_HEADER } from './api-key/api-key-middleware';
export {
  ApiKeyError,
  invalidApiKey,
  forestIdentityNotAllowed,
  invalidRequest,
  keyResolutionUnavailable,
  toErrorBody as toApiKeyErrorBody,
} from './api-key/api-key-error';
export type { ApiKeyErrorType, ApiKeyErrorBody } from './api-key/api-key-error';
