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

async function buildAgent(
  introspection: DataSourceSQLIntrospection | DataSourceMongoIntrospection,
) {
  const agentOptions: AgentOptions = {
    authSecret: 'a'.repeat(64),
    envSecret: 'a'.repeat(64),
    loggerLevel: 'Error',
    isProduction: false,
  };
  const agent = createAgent(agentOptions);

  try {
    if (isDatasourceMongoIntrospection(introspection)) {
      const mongoose = buildDisconnectedMongooseInstance(introspection);
      agent.addDataSource(createMongooseDataSource(mongoose, { flattenMode: 'auto' }));
    } else {
      const sequelize = await buildDisconnectedSequelizeInstance(introspection, null);
      agent.addDataSource(createSequelizeDataSource(sequelize));
    }
  } catch (e) {
    const error = e as Error;

    if (error instanceof IntrospectionFormatError) {
      throw new BusinessError(
        `The version of this CLI is out of date from the version of your cloud agent.\nPlease update @forestadmin/forest-cloud.`,
      );
    }

    throw error;
  }

  return agent;
}

export async function updateTypings(
  introspection: DataSourceSQLIntrospection | DataSourceMongoIntrospection,
  bootstrapPathManager: BootstrapPathManager,
): Promise<void> {
  const agent = await buildAgent(introspection);
  await agent.updateTypesOnFileSystem(bootstrapPathManager.typingsDuringBootstrap, 3);
}

export async function updateTypingsWithCustomizations(
  introspection: DataSourceSQLIntrospection | DataSourceMongoIntrospection,
  distPathManager: DistPathManager,
  bootstrapPathManager: BootstrapPathManager,
): Promise<void> {
  const builtCodePath = path.resolve(distPathManager.distCodeCustomizations);
  await throwIfNoBuiltCode(builtCodePath);
  const agent = await buildAgent(introspection);
  loadCustomization(agent, builtCodePath);
  await agent.updateTypesOnFileSystem(bootstrapPathManager.typings, 3);
}
