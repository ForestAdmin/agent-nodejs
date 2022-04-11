import { Logger } from '@forestadmin/datasource-toolkit';

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
