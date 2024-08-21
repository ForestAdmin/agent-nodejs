import type { Introspection as DataSourceMongoIntrospection } from '@forestadmin/datasource-mongo';
import type { SupportedIntrospection as DataSourceSQLIntrospection } from '@forestadmin/datasource-sql';

import { AgentOptions, createAgent } from '@forestadmin/agent';
import { buildDisconnectedMongooseInstance } from '@forestadmin/datasource-mongo';
import { createMongooseDataSource } from '@forestadmin/datasource-mongoose';
import { createSequelizeDataSource } from '@forestadmin/datasource-sequelize';
import { buildDisconnectedSequelizeInstance } from '@forestadmin/datasource-sql';
import { IntrospectionFormatError } from '@forestadmin/datasource-toolkit';
import path from 'path';

import { throwIfNoBuiltCode } from './access-file';
import BootstrapPathManager from './bootstrap-path-manager';
import DistPathManager from './dist-path-manager';
import loadCustomization from './load-customization';
import { BusinessError } from '../errors';

function isDatasourceMongoIntrospection(
  introspection: DataSourceSQLIntrospection | DataSourceMongoIntrospection,
): introspection is DataSourceMongoIntrospection {
  return 'source' in introspection && introspection.source === '@forestadmin/datasource-mongo';
}

export type Datasources = Array<{
  introspection: DataSourceSQLIntrospection | DataSourceMongoIntrospection;
  datasourceSuffix: string;
  datasourceId: number;
}>;

async function addDatasourceToAgent(
  agent: ReturnType<typeof createAgent>,
  datasource: Datasources[number],
) {
  try {
    const rename = (oldName: string) => `${oldName}${datasource.datasourceSuffix || ''}`;

    if (isDatasourceMongoIntrospection(datasource.introspection)) {
      const mongoose = buildDisconnectedMongooseInstance(datasource.introspection);
      agent.addDataSource(createMongooseDataSource(mongoose, { flattenMode: 'auto' }), {
        rename,
      });
    } else {
      const sequelize = await buildDisconnectedSequelizeInstance(datasource.introspection, null);
      agent.addDataSource(createSequelizeDataSource(sequelize), {
        rename,
      });
    }
  } catch (e) {
    const error = e as Error;

    if (BusinessError.isOfType(error, IntrospectionFormatError)) {
      throw new BusinessError(
        `The version of this CLI is out of date from the version of your cloud agent.\nPlease update @forestadmin/forest-cloud.`,
      );
    }

    throw e;
  }
}

async function buildAgent(datasources: Datasources) {
  const agentOptions: AgentOptions = {
    authSecret: 'a'.repeat(64),
    envSecret: 'a'.repeat(64),
    loggerLevel: 'Error',
    isProduction: false,
  };
  const agent = createAgent(agentOptions);
  await Promise.all(
    datasources
      .sort((a, b) => a.datasourceId - b.datasourceId)
      .map(async datasource => addDatasourceToAgent(agent, datasource)),
  );

  return agent;
}

export async function updateTypings(
  datasources: Datasources,
  bootstrapPathManager: BootstrapPathManager,
): Promise<void> {
  const agent = await buildAgent(datasources);
  await agent.updateTypesOnFileSystem(bootstrapPathManager.typingsDuringBootstrap, 3);
}

export async function updateTypingsWithCustomizations(
  datasources: Datasources,
  distPathManager: DistPathManager,
  bootstrapPathManager: BootstrapPathManager,
): Promise<void> {
  const builtCodePath = path.resolve(distPathManager.distCodeCustomizations);
  await throwIfNoBuiltCode(builtCodePath);
  const agent = await buildAgent(datasources);
  loadCustomization(agent, builtCodePath);
  await agent.updateTypesOnFileSystem(bootstrapPathManager.typings, 3);
}
