/** Logger Level */
export enum LoggerLevel {
  info = 'info',
  warn = 'warn',
  error = 'error',
}

/** Logger */
export type Logger = (level: LoggerLevel, message: string) => void;

/** Options to configure behavior of an agent's frontend */
export interface FrontendOptions {
  prefix: string;
  logger?: Logger;
}

/**
 * Services container
 * This is empty for now, but should grow as we implement all features
 * (at least to contain roles and scopes).
 */
export type FrontendServices = Record<string, never>;
