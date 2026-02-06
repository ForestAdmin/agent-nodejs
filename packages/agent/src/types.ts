import type { ForestAdminHttpDriverServices } from './services';
import type { AiConfiguration, AiProvider } from '@forestadmin/ai-proxy';
import type { CompositeId, DataSource, Logger, LoggerLevel } from '@forestadmin/datasource-toolkit';
import type { ForestAdminClient } from '@forestadmin/forestadmin-client';
import type Router from '@koa/router';
import type { IncomingMessage, ServerResponse } from 'http';

export type { AiConfiguration, AiProvider };

/** Options to configure behavior of an agent's forestadmin driver */
export type AgentOptions = {
  authSecret: string;
  envSecret: string;
  customizeErrorMessage?: ((error: Error) => string | null) | null;
  forestServerUrl?: string;
  forestAppUrl?: string;
  logger?: Logger;
  loggerLevel?: LoggerLevel;
  prefix?: string;
  isProduction: boolean;
  schemaPath?: string;
  typingsPath?: string | null;
  typingsMaxDepth?: number;
  instantCacheRefresh?: boolean;
  permissionsCacheDurationInSeconds?: number;
  skipSchemaUpdate?: boolean;
  forestAdminClient?: ForestAdminClient;
  limitExportSize?: number;
  experimental?: {
    webhookCustomActions?: boolean;
    updateRecordCustomActions?: boolean;
  };
  /**
   * @deprecated use `bodyParserOptions.jsonLimit` instead.
   * @todo remove option
   */
  maxBodySize?: string;
  /**
   * Refer to `@koa/bodyparser` options
   * @link https://github.com/koajs/bodyparser?tab=readme-ov-file#options
   */
  bodyParserOptions?: {
    jsonLimit?: number | string;
    enableRawChecking?: boolean;
  };
  /**
   * If true, the agent will not throw an error when a customization error occurs,
   * because of a missing collection for example.
   * @default false
   */
  ignoreMissingSchemaElementErrors?: boolean;
  useUnsafeActionEndpoint?: boolean;
};
export type AgentOptionsWithDefaults = Readonly<Required<AgentOptions>>;

export type HttpCallback = (req: IncomingMessage, res: ServerResponse, next?: () => void) => void;

export enum HttpCode {
  BadRequest = 400,
  Forbidden = 403,
  InternalServerError = 500,
  NoContent = 204,
  NotFound = 404,
  Ok = 200,
  Unprocessable = 422,
}

export enum RouteType {
  // Changing the values of this enum changes the order in which routes are loaded into koa-router.
  LoggerHandler = 0,
  ErrorHandler = 1,
  PublicRoute = 2,
  PublicCustomRoute = 2.5,
  Authentication = 3,
  PrivateRoute = 4,
  CustomRoute = 5,
}

export type SelectionIds = {
  areExcluded: boolean;
  ids: CompositeId[];
};

/**
 * Context provided to custom router callbacks.
 * Gives access to the dataSource, services, options, and logger.
 */
export interface CustomRouterContext {
  readonly dataSource: DataSource;
  readonly services: ForestAdminHttpDriverServices;
  readonly options: AgentOptionsWithDefaults;
  readonly logger: Logger;
}

/**
 * Callback function for custom routes.
 * Receives a Koa router and context to define custom HTTP endpoints.
 */
export type CustomRouterCallback = (
  router: Router,
  context: CustomRouterContext,
) => void | Promise<void>;

/**
 * Options for custom router configuration.
 */
export interface CustomRouterOptions {
  /** Whether routes require authentication. Default: true */
  authenticated?: boolean;
  /** URL prefix for all routes in this router. Default: '' */
  prefix?: string;
}
