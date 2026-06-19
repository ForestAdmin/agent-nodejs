import type { AuditStore } from './audit-trail/types';
import type { CompositeId, Logger, LoggerLevel } from '@forestadmin/datasource-toolkit';
import type { ForestAdminClient } from '@forestadmin/forestadmin-client';
import type { IncomingMessage, ServerResponse } from 'http';

export type AuditTrailConfig = {
  /**
   * Connection string of the database that will hold the audit log. May point to an empty database,
   * the database already used by the agent, or a database that already contains the `forest`
   * schema. The schema and table are created on the fly when missing.
   */
  connectionString: string;
  /** Schema that namespaces Forest-owned tables. Defaults to `forest`. */
  schema?: string;
  /** Name of the audit table. Defaults to `audit_logs`. */
  tableName?: string;
  /**
   * Field values to mask, keyed by collection name. A redacted field still produces an audit entry
   * when it changes (so the change is recorded), but its value is replaced with a sentinel instead
   * of being stored.
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
   * When set, the agent exposes routes at `/_internal/workflow-executions/`
   * that forward to the executor, benefiting from the agent's authentication layer.
   * @example 'http://localhost:4001'
   */
  workflowExecutorUrl?: string | null;
  /**
   * When set, the agent records every create/update/delete in the configured database and exposes
   * `/_audit-trail/{collection}/:id` (per-record history) and `/_audit-trail/correlation*` routes.
   */
  auditTrail?: AuditTrailConfig | null;
};

/** Runtime shape of `auditTrail` once the validator has built the store from the config. */
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
