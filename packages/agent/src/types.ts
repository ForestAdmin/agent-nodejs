import type { CompositeId, Logger, LoggerLevel } from '@forestadmin/datasource-toolkit';
import type { ForestAdminClient } from '@forestadmin/forestadmin-client';
import type { IncomingMessage, ServerResponse } from 'http';

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
   *
   * Mutually exclusive with `agent.addWorkflowExecutor()`: use this option to target a
   * separately-deployed executor, or `addWorkflowExecutor()` to run one in-process.
   * @example 'http://localhost:4001'
   */
  workflowExecutorUrl?: string | null;
};

/**
 * Options for an embedded workflow executor, started in the same process as the agent
 * through `agent.addWorkflowExecutor()`.
 */
export type WorkflowExecutorEmbedOptions = {
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
  /** Interval in seconds at which the executor polls the orchestrator for pending steps. */
  pollingIntervalS?: number;
  /** Per-step execution timeout in seconds. */
  stepTimeoutS?: number;
  /** Max duration in seconds of a single AI provider invocation. */
  aiInvokeTimeoutS?: number;
  /** Timeout in seconds for draining in-flight steps when the executor stops. */
  stopTimeoutS?: number;
  /** Max steps auto-chained per run before yielding to the next poll. `0` disables chaining. */
  maxChainDepth?: number;
  /** Collection schema cache TTL in seconds. Lower it to pick up orchestrator schema changes sooner. */
  schemaCacheTtlS?: number;
  /** Minimum level of the executor's logs. Defaults to `Info`. */
  loggerLevel?: LoggerLevel;
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
export type AgentOptionsWithDefaults = Readonly<Required<AgentOptions>>;

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
