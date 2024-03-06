import { AgentOptions, createAgent } from '@forestadmin/agent';
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

function buildAgent(introspection: Table[]) {
  const agentOptions: AgentOptions = {
    authSecret: 'a'.repeat(64),
    envSecret: 'a'.repeat(64),
    loggerLevel: 'Error',
    isProduction: false,
  };
  const agent = createAgent(agentOptions);
  agent.addDataSource(createSqlDataSource(`sqlite::memory:`, { introspection }));

  return agent;
}

export async function updateTypings(
  introspection: Table[],
  bootstrapPathManager: BootstrapPathManager,
): Promise<void> {
  const agent = buildAgent(introspection);
  await agent.updateTypesOnFileSystem(bootstrapPathManager.typingsDuringBootstrap, 3);
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
