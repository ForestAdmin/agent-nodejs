import { Logger, LoggerLevel } from '@forestadmin/datasource-toolkit';

/** Options to configure behavior of an agent's forestadmin driver */
export type AgentOptions = {
  agentUrl: string;
  authSecret: string;
  clientId?: string;
  envSecret: string;
  forestServerUrl?: string;
  logger?: Logger;
  loggerLevel?: LoggerLevel;
  prefix?: string;
  isProduction: boolean;
  schemaPath?: string;
  typingsPath?: string;
  typingsMaxDepth?: number;
  permissionsCacheDurationInSeconds?: number;
};
