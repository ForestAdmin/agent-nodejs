import Serializer from './services/serializer';

/** Logger Level */
export enum LoggerLevel {
  info = 'info',
  warn = 'warn',
  error = 'error',
}

/** Logger */
export type Logger = (level: LoggerLevel, message: string) => void;

/** Options to configure behavior of an agent's forestadmin driver */
export interface ForestAdminHttpDriverOptions {
  agentUrl: string;
  authSecret: string;
  clientId?: string;
  envSecret: string;
  forestServerUrl?: string;
  logger?: Logger;
  prefix: string;
}

/**
 * Services container
 * This is empty for now, but should grow as we implement all features
 * (at least to contain roles and scopes).
 */
export type ForestAdminHttpDriverServices = {
  serializer: Serializer;
};
