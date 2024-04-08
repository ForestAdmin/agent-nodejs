import type { Introspection as DataSourceMongoIntrospection } from '@forestadmin/datasource-mongo';
import type { SupportedIntrospection as DataSourceSQLIntrospection } from '@forestadmin/datasource-sql';

import { AgentOptions, createAgent } from '@forestadmin/agent';
import { buildDisconnectedMongooseInstance } from '@forestadmin/datasource-mongo';
import { createMongooseDataSource } from '@forestadmin/datasource-mongoose';
import { createSequelizeDataSource } from '@forestadmin/datasource-sequelize';
import { Table, buildDisconnectedSequelizeInstance } from '@forestadmin/datasource-sql';
import path from 'path';

import { throwIfNoBuiltCode } from './access-file';
import BootstrapPathManager from './bootstrap-path-manager';
import DistPathManager from './dist-path-manager';
import { CustomizationError } from '../errors';
import { Agent } from '../types';

function loadCustomization(agent: Agent, builtCodePath: string): void {
  // eslint-disable-next-line
  const customization = require(builtCodePath);
  const entryPoint = customization?.default || customization;

  if (typeof entryPoint !== 'function') {
    throw new CustomizationError('Customization file must export a function');
  }

  try {
    entryPoint(agent);
  } catch (error) {
    throw new CustomizationError(
      `Issue with customizations: ${error.name}\n${error.message}`,
      error.stack,
    );
  }
}

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

  if (isDatasourceMongoIntrospection(introspection)) {
    const mongoose = buildDisconnectedMongooseInstance(introspection);
    agent.addDataSource(createMongooseDataSource(mongoose, { flattenMode: 'auto' }));
  } else {
    const sequelize = await buildDisconnectedSequelizeInstance(introspection, null);
    agent.addDataSource(createSequelizeDataSource(sequelize));
  }

  return agent;
}

export async function updateTypings(
  introspection: Table[],
  bootstrapPathManager: BootstrapPathManager,
): Promise<void> {
  const agent = await buildAgent(introspection);
  await agent.updateTypesOnFileSystem(bootstrapPathManager.typingsDuringBootstrap, 3);
}

export async function updateTypingsWithCustomizations(
  introspection: Table[],
  distPathManager: DistPathManager,
  bootstrapPathManager: BootstrapPathManager,
): Promise<void> {
  const builtCodePath = path.resolve(distPathManager.distCodeCustomizations);
  await throwIfNoBuiltCode(builtCodePath);
  const agent = await buildAgent(introspection);
  loadCustomization(agent, builtCodePath);
  await agent.updateTypesOnFileSystem(bootstrapPathManager.typings, 3);
}
