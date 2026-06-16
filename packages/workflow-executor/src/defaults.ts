import type { LoggerLevel } from './ports/logger-port';

export const DEFAULT_HTTP_PORT = 3400;
export const DEFAULT_FOREST_SERVER_URL = 'https://api.forestadmin.com';
export const DEFAULT_POLLING_INTERVAL_S = 30;
export const DEFAULT_STEP_TIMEOUT_S = 5 * 60;
export const DEFAULT_AI_INVOKE_TIMEOUT_S = 30;
export const DEFAULT_STOP_TIMEOUT_S = 30;
export const DEFAULT_MAX_CHAIN_DEPTH = 50;
export const DEFAULT_SCHEMA_CACHE_TTL_S = 10 * 60;
export const DEFAULT_LOGGER_LEVEL: LoggerLevel = 'Info';
// Refresh an OAuth access token this many seconds before it actually expires, so a token never
// goes stale mid-request between the skew check and the downstream MCP call.
export const DEFAULT_OAUTH_EXPIRY_SKEW_S = 60;
