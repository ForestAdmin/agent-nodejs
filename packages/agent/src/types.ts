import type { AuditStore } from './audit-trail/types';
import type { CompositeId, Logger, LoggerLevel } from '@forestadmin/datasource-toolkit';
import type { ForestAdminClient } from '@forestadmin/forestadmin-client';
import type { IncomingMessage, ServerResponse } from 'http';

export type AuditTrailConfig = {
  /**
   * Postgres / SQL connection string for the audit database. May point at an empty database, the
   * database already used by the agent, or one that already contains the `forest` schema — the
   * schema and table are created on the fly when missing.
   */
  connectionString: string;
  /** Defaults to `forest`. */
  schema?: string;
  /** Defaults to `audit_logs`. */
  tableName?: string;
  /**
   * Fields to mask, keyed by collection name. Redacted fields still produce an audit entry when
   * they change, but their value is replaced with a sentinel instead of being stored.
   */
  redact?: Record<string, string[]>;
};

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
  /**
   * Base URL of the workflow executor to proxy requests to.
   * When set, the agent forwards `/_internal/executor/*` to the executor verbatim,
   * benefiting from the agent's authentication layer.
   * @example 'http://localhost:4001'
   */
  workflowExecutorUrl?: string | null;
  /**
   * Records every create/update/delete and exposes `/_audit-trail/{collection}/:id` and
   * `/_audit-trail/correlation*` routes. Disabled when `null` or unset.
   */
  auditTrail?: AuditTrailConfig | null;
};

// Runtime view of `auditTrail`: the validator has built the SQL store from the connection string.
export type AuditTrailRuntime = AuditTrailConfig & { store: AuditStore };

export type AgentOptionsWithDefaults = Readonly<
  Required<Omit<AgentOptions, 'auditTrail'>> & {
    auditTrail: AuditTrailRuntime | null;
  }
>;

export type HttpCallback = (req: IncomingMessage, res: ServerResponse, next?: () => void) => void;

export enum HttpCode {
  BadRequest = 400,
  Unauthorized = 401,
  Forbidden = 403,
  NotFound = 404,
  Unprocessable = 422,
  TooManyRequests = 429,
  InternalServerError = 500,
  NoContent = 204,
  Ok = 200,
}

export enum RouteType {
  // Changing the values of this enum changes the order in which routes are loaded into koa-router.
  LoggerHandler = 0,
  ErrorHandler = 1,
  PublicRoute = 2,
  Authentication = 3,
  PrivateRoute = 4,
}

export type SelectionIds = {
  areExcluded: boolean;
  ids: CompositeId[];
};
