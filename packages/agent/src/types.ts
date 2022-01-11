/** Logger Level */
export enum LoggerLevel {
  Info = 'info',
  Warn = 'warn',
  Error = 'error',
}

/** Logger */
export type Logger = (level: LoggerLevel, message: string) => void;

/** Options to configure behavior of an agent's forestadmin driver */
export interface ForestAdminHttpDriverOptions {
  agentUrl: string;
  authSecret: string;
  clientId?: string;
  envSecret: string;
  forestServerUrl: string;
  logger?: Logger;
  prefix: string;
  isProduction: boolean;
  schemaDir: string;
}

export enum HttpCode {
  Forbidden = 403,
  BadRequest = 400,
  InternalServerError = 500,
  NoContent = 204,
  Ok = 200,
}
