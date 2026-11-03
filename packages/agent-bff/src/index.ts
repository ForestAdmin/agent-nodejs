export { default as BFFHttpServer } from './http/bff-http-server';
export { CONFIG_KEYS, parseConfig, parsePublicUrl, REQUIRED_KEYS } from './config/env-config';
export type {
  BFFConfig,
  PresenceMap,
  RequiredKey,
  ConfigKey,
  ConfigLabels,
} from './config/env-config';
export { default as runCli, installShutdownHandlers } from './cli-core';
export { default as renderOpenApi } from './openapi/render-openapi';
export { DEFAULT_OUTPUT_FILE, OUTPUT_FLAG, parseOutputOption, writeOutputFile } from './cli-output';
export type { OutputOption } from './cli-output';
export { default as buildBff } from './build-bff';
export {
  default as createInProcessTransport,
  IN_PROCESS_AGENT_URL,
} from './agent/in-process-transport';
export type {
  AgentDispatcher,
  AgentDispatchRequest,
  AgentDispatchResponse,
} from './agent/in-process-transport';
export type { Bff, BuildBffOptions, BffCallback } from './build-bff';
export type { BffHealth, HealthConfigured } from './http/health-route';
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
export { default as createSessionTokenCodec } from './oauth/session-token';
export type { SessionTokenCodec, SessionState, ServerAccessBinding } from './oauth/session-token';
export { default as createAuthorizationCodeClaims } from './oauth/authorization-code-claims';
export type { AuthorizationCodeClaims } from './oauth/authorization-code-claims';
export { default as createTokenCipher } from './oauth/token-cipher';
export { default as resolveServerAccess } from './oauth/server-access';
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
export {
  default as createApiKeyMiddleware,
  BFF_KEY_HEADER,
  GATEWAY_KEY_HEADER,
} from './api-key/api-key-middleware';
export {
  ApiKeyError,
  invalidApiKey,
  forestIdentityNotAllowed,
  invalidRequest,
  keyResolutionUnavailable,
  toErrorBody as toApiKeyErrorBody,
} from './api-key/api-key-error';
export type { ApiKeyErrorType, ApiKeyErrorBody } from './api-key/api-key-error';
export { default as claimsBffPath } from './claims-bff-path';
export type { ClaimsBffPathOptions } from './claims-bff-path';
