/** Logger Level */
export enum LoggerLevel {
  Info = 'info',
  Warn = 'warn',
  Error = 'error',
}

/** Logger */
export type Logger = (level: LoggerLevel, message: string) => void;

/** Options to configure behavior of an agent's forestadmin driver */
export type ForestAdminHttpDriverOptions = {
  agentUrl: string;
  authSecret: string;
  clientId?: string;
  envSecret: string;
  forestServerUrl?: string;
  logger?: Logger;
  prefix?: string;
  isProduction: boolean;
  schemaPath?: string;
};

export type ForestAdminHttpDriverOptionsWithDefaults = Readonly<
  Required<ForestAdminHttpDriverOptions>
>;

export enum HttpCode {
  BadRequest = 400,
  Forbidden = 403,
  InternalServerError = 500,
  NoContent = 204,
  NotFound = 404,
  Ok = 200,
}
