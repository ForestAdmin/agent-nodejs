import type { AuditStore } from './audit-trail/types';
import type { CompositeId, Logger, LoggerLevel } from '@forestadmin/datasource-toolkit';
import type { ForestAdminClient } from '@forestadmin/forestadmin-client';
import type { WorkflowExecutorTuningOptions } from '@forestadmin/workflow-executor';
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
  /**
   * `true` refuses a write when its pending audit entry fails to record: nothing is written, no
   * compensating write is issued. `false` (default) swallows the failure and lets the write proceed
   * unaudited. What this buys is no unaudited write, not every row holding exact after-values — a
   * row left `pending` means the write may or may not have landed, and that residue is evidence a
   * write was attempted and never confirmed, which is the point.
   * @default false
   */
  critical?: boolean;
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
   * Serve columns of collections the caller has no `read` permission on when they are reached
   * through a relation path (`holder:nationalId`) in a projection, a filter, a sort, a search or a
   * chart. The route's own `browse`/`read`/`export` check on the collection being queried is
   * unaffected.
   * @default false
   */
  skipRelationReadPermissions?: boolean;
  /**
   * Max number of records a "select all" approval-required action may target.
   * Must not exceed the Forest server's own cap (500).
   * @default 500
   */
  maxRecordsForApproval?: number;
  /**
   * Base URL of the workflow executor to proxy requests to.
   * When set, the agent forwards `/_internal/executor/*` to the executor verbatim,
   * benefiting from the agent's authentication layer.
   *
   * Mutually exclusive with `agent.addWorkflowExecutor()`: use this option to target a
   * separately-deployed executor, or `addWorkflowExecutor()` to run one in-process.
   * @example 'http://localhost:4001'
   */
  workflowExecutorUrl?: string | null;
  /**
   * Records every create/update/delete and exposes `/_audit-trail/{collection}/:id` and
   * `/_audit-trail/correlation*` routes. Disabled when `null` or unset.
   */
  auditTrail?: AuditTrailConfig | null;
};

/**
 * Options for an embedded workflow executor, started in the same process as the agent
 * through `agent.addWorkflowExecutor()`.
 */
export type WorkflowExecutorEmbedOptions = Omit<WorkflowExecutorTuningOptions, 'loggerLevel'> & {
  /**
   * Use an in-memory run store instead of a database. No database is required, but runs are lost
   * when the process restarts, so it is not meant for production. Mutually exclusive with
   * `database`.
   */
  inMemory?: boolean;
  /**
   * Database connection used to persist workflow run state. Accepts a connection URI or a
   * Sequelize options object. The agent throws at startup if it is omitted (unless `inMemory` is
   * set).
   */
  database?: { uri?: string; [option: string]: unknown };
  /**
   * URL the executor uses to reach this agent's data layer.
   * Auto-derived when the agent runs on its own server (`mountOnStandaloneServer`).
   * Required when the agent is mounted on an external framework (Express/Fastify/NestJS),
   * since the agent cannot know the host application's address.
   */
  agentUrl?: string;
  /**
   * Loopback port the embedded executor listens on; the agent proxies to it internally.
   * Defaults to `3400`.
   */
  port?: number;
  /**
   * Bring your own AI provider instead of Forest's AI server. All three fields are required
   * together; omit `ai` entirely to keep using Forest's server.
   */
  ai?: { provider: 'anthropic' | 'openai'; model: string; apiKey: string };
  /**
   * HKDF secret encrypting OAuth-protected MCP connector credentials at rest. Only needed if you
   * use OAuth-protected MCP connectors; without it their credential deposits return 503. Embed-time
   * equivalent of the standalone `FOREST_EXECUTOR_ENCRYPTION_KEY` env var.
   */
  encryptionKey?: string;
};

// Runtime view of `auditTrail`: the validator has built the SQL store from the connection string.
export type AuditTrailRuntime = AuditTrailConfig & {
  store: AuditStore;
  close: () => Promise<void>;
};

export type AgentOptionsWithDefaults = Readonly<
  Required<Omit<AgentOptions, 'auditTrail'>> & {
    auditTrail: AuditTrailRuntime | null;
  }
>;

export type HttpCallback = (req: IncomingMessage, res: ServerResponse, next?: () => void) => void;

export type McpRouteMatcher = (url: string) => boolean;

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
