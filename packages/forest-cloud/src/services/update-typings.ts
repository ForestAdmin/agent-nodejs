import type { Introspection as DataSourceMongoIntrospection } from '@forestadmin/datasource-mongo';
import type { SupportedIntrospection as DataSourceSQLIntrospection } from '@forestadmin/datasource-sql';

import { AgentOptions, createAgent } from '@forestadmin/agent';
import { createMongoDataSource } from '@forestadmin/datasource-mongo';
import { Table, createSqlDataSource } from '@forestadmin/datasource-sql';
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

function buildAgent(introspection: DataSourceSQLIntrospection | DataSourceMongoIntrospection) {
  const agentOptions: AgentOptions = {
    authSecret: 'a'.repeat(64),
    envSecret: 'a'.repeat(64),
    loggerLevel: 'Error',
    isProduction: false,
  };
  const agent = createAgent(agentOptions);

  if (isDatasourceMongoIntrospection(introspection)) {
    agent.addDataSource(
      createMongoDataSource(
        { uri: 'mongodb://dummy-uri', dataSource: { flattenMode: 'auto' } },
        { introspection },
      ),
    );
  } else {
    agent.addDataSource(
      createSqlDataSource({ dialect: 'sqlite', storage: ':memory:' }, { introspection }),
    );
  }

  return agent;
}

export async function updateTypings(
  introspection: Table[],
  bootstrapPathManager: BootstrapPathManager,
): Promise<void> {
  const agent = buildAgent(introspection);
  await agent.updateTypesOnFileSystem(bootstrapPathManager.typingsDuringBootstrap, 3);
  process.exit(0);
}

export async function updateTypingsWithCustomizations(
  introspection: Table[],
  distPathManager: DistPathManager,
  bootstrapPathManager: BootstrapPathManager,
): Promise<void> {
  const builtCodePath = path.resolve(distPathManager.distCodeCustomizations);
  await throwIfNoBuiltCode(builtCodePath);
  const agent = buildAgent(introspection);
  loadCustomization(agent, builtCodePath);
  await agent.updateTypesOnFileSystem(bootstrapPathManager.typings, 3);
}
