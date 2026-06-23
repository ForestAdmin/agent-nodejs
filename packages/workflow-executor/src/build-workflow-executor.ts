import type { Logger, LoggerLevel } from './ports/logger-port';
import type { RunnerState } from './runner';
import type { AiConfiguration } from '@forestadmin/ai-proxy';
import type { Options as SequelizeOptions } from 'sequelize';

import { ActivityLogsService, ForestHttpApi } from '@forestadmin/forestadmin-client';
import { Sequelize } from 'sequelize';

import AgentClientAgentPort from './adapters/agent-client-agent-port';
import AiClientAdapter from './adapters/ai-client-adapter';
import AlwaysErrorAiModelPort from './adapters/always-error-ai-model-port';
import createConsoleLogger from './adapters/console-logger';
import ForestServerWorkflowPort from './adapters/forest-server-workflow-port';
import ForestadminClientActivityLogPortFactory from './adapters/forestadmin-client-activity-log-port-factory';
import ServerAiAdapter from './adapters/server-ai-adapter';
import {
  DEFAULT_AI_INVOKE_TIMEOUT_S,
  DEFAULT_FOREST_SERVER_URL,
  DEFAULT_LOGGER_LEVEL,
  DEFAULT_POLLING_INTERVAL_S,
  DEFAULT_SCHEMA_CACHE_TTL_S,
  DEFAULT_STEP_TIMEOUT_S,
} from './defaults';
import ExecutorHttpServer from './http/executor-http-server';
import Runner from './runner';
import SchemaCache from './schema-cache';
import DatabaseStore from './stores/database-store';
import InMemoryStore from './stores/in-memory-store';

const FORCE_EXIT_DELAY_S = 5;

export interface WorkflowExecutor {
  start(): Promise<void>;
  stop(): Promise<void>;
  // Apply migrations then exit (the `migrate` CLI command). Does not start the runner or server.
  migrate(): Promise<void>;
  readonly state: RunnerState;
}

export interface ExecutorOptions {
  envSecret: string;
  authSecret: string;
  agentUrl: string;
  httpPort: number;
  forestServerUrl?: string;
  aiConfigurations?: AiConfiguration[];
  pollingIntervalS?: number;
  logger?: Logger;
  loggerLevel?: LoggerLevel;
  stopTimeoutS?: number;
  stepTimeoutS?: number;
  aiInvokeTimeoutS?: number;
  // Max auto-chained steps per entry (see RunnerConfig.maxChainDepth). 0 disables chaining.
  maxChainDepth?: number;
  // Collection schema cache TTL in seconds. Lower it to pick up orchestrator schema changes sooner.
  schemaCacheTtlS?: number;
  // Dev only: makes every AI call fail immediately so error paths can be exercised locally.
  forceAiError?: boolean;
  // Boot without running migrations (applied out-of-band via the `migrate` command).
  skipMigrations?: boolean;
}

export type DatabaseExecutorOptions = ExecutorOptions &
  ({ database: SequelizeOptions & { uri: string } } | { database: SequelizeOptions });

// A bad timeout config (0, negative, non-finite) must fall back to the default rather than
// silently disabling the timeout — `?? default` only catches null/undefined, not 0/negative.
function positiveOrDefault(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function buildCommonDependencies(options: ExecutorOptions) {
  const forestServerUrl = options.forestServerUrl ?? DEFAULT_FOREST_SERVER_URL;
  const logger = options.logger ?? createConsoleLogger(options.loggerLevel ?? DEFAULT_LOGGER_LEVEL);

  const workflowPort = new ForestServerWorkflowPort({
    envSecret: options.envSecret,
    forestServerUrl,
    logger,
  });

  const forceAiError = options.forceAiError && process.env.NODE_ENV !== 'production';

  if (forceAiError) {
    logger(
      'Info',
      'FORCE_AI_ERROR is enabled — AI calls will always fail. Do not use in production.',
    );
  } else if (options.forceAiError && process.env.NODE_ENV === 'production') {
    logger('Info', 'FORCE_AI_ERROR is set but ignored in production.');
  }

  let aiModelPort;

  if (forceAiError) {
    aiModelPort = new AlwaysErrorAiModelPort();
  } else if (options.aiConfigurations?.length) {
    aiModelPort = new AiClientAdapter(options.aiConfigurations);
  } else {
    aiModelPort = new ServerAiAdapter({ forestServerUrl, envSecret: options.envSecret });
  }

  // A TTL of 0/negative/non-finite would silently make the cache always-stale, so fall back.
  const schemaCache = new SchemaCache(
    positiveOrDefault(options.schemaCacheTtlS, DEFAULT_SCHEMA_CACHE_TTL_S),
  );

  const agentPort = new AgentClientAgentPort({
    agentUrl: options.agentUrl,
    authSecret: options.authSecret,
    schemaCache,
  });

  const activityLogsService = new ActivityLogsService(new ForestHttpApi(), {
    forestServerUrl,
    headers: { 'Forest-Application-Source': 'WorkflowExecutor' },
  });
  const activityLogPortFactory = new ForestadminClientActivityLogPortFactory(
    activityLogsService,
    logger,
  );

  return {
    agentPort,
    schemaCache,
    workflowPort,
    aiModelPort,
    activityLogPortFactory,
    logger,
    pollingIntervalS: options.pollingIntervalS ?? DEFAULT_POLLING_INTERVAL_S,
    envSecret: options.envSecret,
    authSecret: options.authSecret,
    stopTimeoutS: options.stopTimeoutS,
    stepTimeoutS: positiveOrDefault(options.stepTimeoutS, DEFAULT_STEP_TIMEOUT_S),
    aiInvokeTimeoutS: positiveOrDefault(options.aiInvokeTimeoutS, DEFAULT_AI_INVOKE_TIMEOUT_S),
    maxChainDepth: options.maxChainDepth,
    skipMigrations: options.skipMigrations,
  };
}

function createWorkflowExecutor(
  runner: Runner,
  server: ExecutorHttpServer,
  logger: Logger,
): WorkflowExecutor {
  let shutdownPromise: Promise<void> | null = null;

  const shutdown = async () => {
    try {
      await server.stop();
    } catch (err) {
      logger('Error', 'HTTP server close failed during shutdown', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    await runner.stop();
  };

  const onSignal = async () => {
    logger('Info', 'Received shutdown signal, stopping gracefully...');

    try {
      if (!shutdownPromise) shutdownPromise = shutdown();
      await shutdownPromise;
      process.exitCode = 0;
    } catch (error) {
      logger('Error', 'Graceful shutdown failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      process.exitCode = 1;
    }

    // Safety net: force exit if the event loop doesn't drain
    // eslint-disable-next-line no-console
    setTimeout(() => {
      logger('Error', 'Process did not exit after shutdown — forcing exit');
      process.exit(process.exitCode ?? 1);
    }, FORCE_EXIT_DELAY_S * 1000).unref();
  };

  return {
    get state() {
      return runner.state;
    },

    migrate() {
      return runner.migrate();
    },

    async start() {
      await runner.start();
      await server.start();

      process.on('SIGTERM', onSignal);
      process.on('SIGINT', onSignal);
    },

    async stop() {
      process.removeListener('SIGTERM', onSignal);
      process.removeListener('SIGINT', onSignal);

      if (!shutdownPromise) shutdownPromise = shutdown();
      await shutdownPromise;
    },
  };
}

export function buildInMemoryExecutor(options: ExecutorOptions): WorkflowExecutor {
  const deps = buildCommonDependencies(options);

  const runner = new Runner({
    ...deps,
    runStore: new InMemoryStore(),
  });

  const server = new ExecutorHttpServer({
    port: options.httpPort,
    runner,
    authSecret: options.authSecret,
    workflowPort: deps.workflowPort,
    logger: deps.logger,
  });

  return createWorkflowExecutor(runner, server, deps.logger);
}

export function buildDatabaseExecutor(options: DatabaseExecutorOptions): WorkflowExecutor {
  const deps = buildCommonDependencies(options);
  const { uri, ...sequelizeOptions } = options.database as SequelizeOptions & { uri?: string };
  // Silence Sequelize's verbose SQL logger by default so our structured logs
  // stay readable. Caller can still opt in via options.database.logging.
  // An explicit `logging: undefined` in the caller overrides our default via
  // spread, so we re-apply the default when the merged value ends up undefined.
  const sequelizeDefaults: SequelizeOptions = { logging: false };
  const mergedOptions: SequelizeOptions = { ...sequelizeDefaults, ...sequelizeOptions };
  if (mergedOptions.logging === undefined) mergedOptions.logging = false;
  const sequelize = uri ? new Sequelize(uri, mergedOptions) : new Sequelize(mergedOptions);

  const runner = new Runner({
    ...deps,
    runStore: new DatabaseStore({ sequelize }),
  });

  const server = new ExecutorHttpServer({
    port: options.httpPort,
    runner,
    authSecret: options.authSecret,
    workflowPort: deps.workflowPort,
    logger: deps.logger,
  });

  return createWorkflowExecutor(runner, server, deps.logger);
}
