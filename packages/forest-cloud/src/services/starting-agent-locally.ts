import type { Datasources as ProductionDatasources } from './update-typings';

import { AgentOptions, createAgent } from '@forestadmin/agent';
import {
  ConnectionParams,
  MongoDatasourceParams,
  createMongoDataSource,
} from '@forestadmin/datasource-mongo';
import { ConnectionOptions, createSqlDataSource } from '@forestadmin/datasource-sql';
import fs from 'fs/promises';
import path from 'path';

import { throwIfNoBuiltCode } from './access-file';
import DistPathManager from './dist-path-manager';
import loadCustomization from './load-customization';
import { BusinessError } from '../errors';
import { EnvironmentVariables } from '../types';

type Datasources = Record<
  string,
  {
    connectionOptions: ConnectionOptions | ConnectionParams;
    datasourceSuffix?: string;
  }
>;

function getDialectFromConnectionOptions(connectionOptions: ConnectionOptions | ConnectionParams) {
  if (typeof connectionOptions === 'string') {
    const parsed = new URL(connectionOptions);

    return parsed.protocol.slice(0, -1);
  }

  if (typeof connectionOptions.uri === 'string') {
    const parsed = new URL(connectionOptions.uri);

    return parsed.protocol.slice(0, -1);
  }

  return 'sql';
}

function isDatasourceMongoConnection(connection: ConnectionOptions | MongoDatasourceParams) {
  const dialect = getDialectFromConnectionOptions(connection);

  return ['mongodb', 'mongodb+srv'].includes(dialect);
}

async function addDatasourceToAgent(
  agent: ReturnType<typeof createAgent>,
  datasources: Datasources,
) {
  Object.values(datasources).forEach(async datasource => {
    const rename = (oldName: string) => `${oldName}${datasource.datasourceSuffix || ''}`;

    if (isDatasourceMongoConnection(datasource.connectionOptions)) {
      agent.addDataSource(
        createMongoDataSource({
          ...(typeof datasource.connectionOptions === 'string'
            ? { uri: datasource.connectionOptions }
            : datasource.connectionOptions),
          dataSource: { flattenMode: 'auto' },
        } as MongoDatasourceParams),
        {
          rename,
        },
      );
    } else {
      agent.addDataSource(createSqlDataSource(datasource.connectionOptions), {
        rename,
      });
    }
  });
}

// eslint-disable-next-line import/prefer-default-export
export async function startingAgent(
  distPathManager: DistPathManager,
  productionDatasources: ProductionDatasources,
  vars: EnvironmentVariables,
  logger: AgentOptions['logger'],
): Promise<void> {
  const agentOptions: AgentOptions = {
    authSecret: 'dev8environment'.repeat(8),
    // New environment variable or fetch it to the server when launching it ? Could be easier from a user perspective (if no dev env we could create it)
    envSecret: process.env.FOREST_ENV_SECRET_DEVELOPMENT,
    // Needed for lumberjacks
    forestServerUrl: vars.FOREST_SERVER_URL,

    loggerLevel: 'Error',
    isProduction: false,
    logger,
  };

  const localDatasourcesPath = path.resolve(distPathManager.localDatasources);

  const agent = createAgent(agentOptions);

  try {
    await fs.access(localDatasourcesPath);
    // eslint-disable-next-line import/no-dynamic-require, global-require, @typescript-eslint/no-var-requires
    const localDatasources = require(localDatasourcesPath);

    addDatasourceToAgent(agent, localDatasources);
  } catch (e) {
    logger('Debug', `Could not load ${localDatasourcesPath}`, e);
    throw new BusinessError(
      `No datasources found at ${localDatasourcesPath}.\nPlease provide datasources information..`,
    );
  }

  const builtCodePath = path.resolve(distPathManager.distCodeCustomizations);

  await throwIfNoBuiltCode(builtCodePath);
  loadCustomization(agent, builtCodePath);

  await agent.mountOnStandaloneServer().start();
}
