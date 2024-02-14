import { AgentOptions, createAgent } from '@forestadmin/agent';
import { Table, createSqlDataSource } from '@forestadmin/datasource-sql';
import fs from 'fs';
import path from 'path';

import DistPathManager from './dist-path-manager';
import { BusinessError, CustomizationError } from '../errors';
import { Agent } from '../types';

function indexPath(distPathManager: DistPathManager) {
  return path.resolve(distPathManager.distCodeCustomizations);
}

function loadCustomization(agent: Agent, distPathManager: DistPathManager): void {
  // eslint-disable-next-line
  const customization = require(indexPath(distPathManager));
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

export async function updateTypings(typingsPath: string, introspection: Table[]): Promise<void> {
  const agent = buildAgent(introspection);
  await agent.updateTypesOnFileSystem(typingsPath, 3);
}

export async function updateTypingsWithCustomizations(
  typingsPath: string,
  introspection: Table[],
  distPathManager: DistPathManager,
): Promise<void> {
  const agent = buildAgent(introspection);

  if (fs.existsSync(indexPath(distPathManager))) {
    loadCustomization(agent, distPathManager);
  } else {
    throw new BusinessError(
      `No built customization found at ${indexPath(distPathManager)}.\n` +
        'Please run `yarn build` to build your customizations.',
    );
  }

  await agent.updateTypesOnFileSystem(typingsPath, 3);
}
