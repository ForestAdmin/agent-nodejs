/** Logger Level */
export enum LoggerLevel {
  Info = 'info',
  Warn = 'warn',
  Error = 'error',
}

/** Logger */
export type Logger = (level: LoggerLevel, message: unknown) => void;

/** Options to configure behavior of an agent's forestadmin driver */
export type AgentOptions = {
  agentUrl: string;
  authSecret: string;
  clientId?: string;
  envSecret: string;
  forestServerUrl?: string;
  logger?: Logger;
  prefix?: string;
  isProduction: boolean;
  schemaPath?: string;
  permissionsCacheDurationInSeconds?: number;
};
