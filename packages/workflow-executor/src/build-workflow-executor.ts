import type { Logger } from './ports/logger-port';
import type { RunnerState } from './runner';
import type { AiConfiguration } from '@forestadmin/ai-proxy';
import type { Options as SequelizeOptions } from 'sequelize';

import { AiClient } from '@forestadmin/ai-proxy';
import { EventEmitter } from 'events';
import { Sequelize } from 'sequelize';

import AgentClientAgentPort from './adapters/agent-client-agent-port';
import ConsoleLogger from './adapters/console-logger';
import ForestServerWorkflowPort from './adapters/forest-server-workflow-port';
import ExecutorHttpServer from './http/executor-http-server';
import Runner from './runner';
import SchemaCache from './schema-cache';
import DatabaseStore from './stores/database-store';
import InMemoryStore from './stores/in-memory-store';

const DEFAULT_FOREST_SERVER_URL = 'https://api.forestadmin.com';
const DEFAULT_POLLING_INTERVAL_MS = 5000;
const FORCE_EXIT_DELAY_MS = 5000;

export interface WorkflowExecutor {
  start(): Promise<void>;
  stop(): Promise<void>;
  readonly state: RunnerState;
}

export interface ExecutorOptions {
  envSecret: string;
  authSecret: string;
  agentUrl: string;
  httpPort: number;
  forestServerUrl?: string;
  aiConfigurations: AiConfiguration[];
  pollingIntervalMs?: number;
  logger?: Logger;
  stopTimeoutMs?: number;
}

export type DatabaseExecutorOptions = ExecutorOptions &
  ({ database: SequelizeOptions & { uri: string } } | { database: SequelizeOptions });

function buildCommonDependencies(options: ExecutorOptions) {
  const forestServerUrl = options.forestServerUrl ?? DEFAULT_FOREST_SERVER_URL;
  const logger = options.logger ?? new ConsoleLogger();

  const workflowPort = new ForestServerWorkflowPort({
    envSecret: options.envSecret,
    forestServerUrl,
  });

  const aiClient = new AiClient({
    aiConfigurations: options.aiConfigurations,
  });

  const schemaCache = new SchemaCache();

  const agentPort = new AgentClientAgentPort({
    agentUrl: options.agentUrl,
    authSecret: options.authSecret,
    schemaCache,
  });

  return {
    agentPort,
    schemaCache,
    workflowPort,
    aiClient,
    logger,
    pollingIntervalMs: options.pollingIntervalMs ?? DEFAULT_POLLING_INTERVAL_MS,
    envSecret: options.envSecret,
    authSecret: options.authSecret,
    stopTimeoutMs: options.stopTimeoutMs,
  };
}

function createWorkflowExecutor(
  runner: Runner,
  server: ExecutorHttpServer,
  logger: Logger,
  httpPort: number,
): WorkflowExecutor {
  let shutdownPromise: Promise<void> | null = null;

  const shutdown = async () => {
    try {
      await server.stop();
    } catch (err) {
      logger.error('HTTP server close failed during shutdown', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    await runner.stop();
  };

  const onSignal = async () => {
    logger.info?.('Received shutdown signal, stopping gracefully...', {});

    try {
      if (!shutdownPromise) shutdownPromise = shutdown();
      await shutdownPromise;
      process.exitCode = 0;
    } catch (error) {
      logger.error('Graceful shutdown failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      process.exitCode = 1;
    }

    // Safety net: force exit if the event loop doesn't drain
    // eslint-disable-next-line no-console
    setTimeout(() => {
      logger.error('Process did not exit after shutdown — forcing exit', {});
      process.exit(process.exitCode ?? 1);
    }, FORCE_EXIT_DELAY_MS).unref();
  };

  return {
    get state() {
      return runner.state;
    },

    async start() {
      await runner.start();
      await server.start();

      logger.info('Debug dashboard available at', {
        url: `http://localhost:${httpPort}/debug`,
      });

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
  const events = new EventEmitter();

  const runner = new Runner({
    ...deps,
    runStore: new InMemoryStore(),
    events,
  });

  const server = new ExecutorHttpServer({
    port: options.httpPort,
    runner,
    authSecret: options.authSecret,
    workflowPort: deps.workflowPort,
    logger: deps.logger,
    events,
  });

  return createWorkflowExecutor(runner, server, deps.logger, options.httpPort);
}

export function buildDatabaseExecutor(options: DatabaseExecutorOptions): WorkflowExecutor {
  const deps = buildCommonDependencies(options);
  const events = new EventEmitter();
  const { uri, ...sequelizeOptions } = options.database as SequelizeOptions & { uri?: string };
  const sequelize = uri ? new Sequelize(uri, sequelizeOptions) : new Sequelize(sequelizeOptions);

  const runner = new Runner({
    ...deps,
    runStore: new DatabaseStore({ sequelize }),
    events,
  });

  const server = new ExecutorHttpServer({
    port: options.httpPort,
    runner,
    authSecret: options.authSecret,
    workflowPort: deps.workflowPort,
    logger: deps.logger,
    events,
  });

  return createWorkflowExecutor(runner, server, deps.logger, options.httpPort);
}
