import type { Logger } from './ports/logger-port';
import type { AiConfiguration } from '@forestadmin/ai-proxy';
import type { Options as SequelizeOptions } from 'sequelize';

import { AiClient } from '@forestadmin/ai-proxy';
import { Sequelize } from 'sequelize';

import AgentClientAgentPort from './adapters/agent-client-agent-port';
import ForestServerWorkflowPort from './adapters/forest-server-workflow-port';
import Runner from './runner';
import SchemaCache from './schema-cache';
import DatabaseStore from './stores/database-store';
import InMemoryStore from './stores/in-memory-store';

const DEFAULT_FOREST_SERVER_URL = 'https://api.forestadmin.com';
const DEFAULT_POLLING_INTERVAL_MS = 5000;

export interface WorkflowExecutor {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface ExecutorOptions {
  envSecret: string;
  authSecret: string;
  agentUrl: string;
  forestServerUrl?: string;
  aiConfigurations: AiConfiguration[];
  pollingIntervalMs?: number;
  httpPort?: number;
  logger?: Logger;
}

export type DatabaseExecutorOptions = ExecutorOptions &
  ({ database: SequelizeOptions & { uri: string } } | { database: SequelizeOptions });

function buildCommonDependencies(options: ExecutorOptions) {
  const forestServerUrl = options.forestServerUrl ?? DEFAULT_FOREST_SERVER_URL;

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
    pollingIntervalMs: options.pollingIntervalMs ?? DEFAULT_POLLING_INTERVAL_MS,
    envSecret: options.envSecret,
    authSecret: options.authSecret,
    httpPort: options.httpPort,
    logger: options.logger,
  };
}

export function buildInMemoryExecutor(options: ExecutorOptions): WorkflowExecutor {
  return new Runner({
    ...buildCommonDependencies(options),
    runStore: new InMemoryStore(),
  });
}

export function buildDatabaseExecutor(options: DatabaseExecutorOptions): WorkflowExecutor {
  const { uri, ...sequelizeOptions } = options.database as SequelizeOptions & { uri?: string };
  const sequelize = uri ? new Sequelize(uri, sequelizeOptions) : new Sequelize(sequelizeOptions);

  return new Runner({
    ...buildCommonDependencies(options),
    runStore: new DatabaseStore({ sequelize }),
  });
}
