export { default as BFFHttpServer } from './http/bff-http-server';
export { parseConfig, REQUIRED_KEYS } from './config/env-config';
export type { BFFConfig, PresenceMap, RequiredKey } from './config/env-config';
export { default as runCli } from './cli-core';
export { ConfigurationError } from './errors';
export { default as DEFAULT_BFF_PORT } from './defaults';
export { default as createConsoleLogger } from './adapters/console-logger';
export type { Logger, LoggerLevel } from './ports/logger-port';
export { default as version } from './version';
