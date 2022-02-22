/** Logger Level */
import { CompositeId } from '@forestadmin/datasource-toolkit';

export enum LoggerLevel {
  Info = 'info',
  Warn = 'warn',
  Error = 'error',
}

/** Logger */
export type Logger = (level: LoggerLevel, message: unknown) => void;

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
  permissionsCacheDurationInSeconds?: number;
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

export enum RouteType {
  // Changing the values of this enum changes the order in which routes are loaded into koa-router.
  Logger = 0,
  ErrorHandler = 1,
  PublicRoute = 2,
  Authentication = 3,
  PrivateRoute = 4,
}

export type SelectionIds = {
  areExcluded: boolean;
  ids: CompositeId[];
};
