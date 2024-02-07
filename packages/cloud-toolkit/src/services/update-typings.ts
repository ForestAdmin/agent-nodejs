import { AgentOptions, createAgent } from '@forestadmin/agent';
import { Table, createSqlDataSource } from '@forestadmin/datasource-sql';
import fs from 'fs';
import path from 'path';

import { distPath } from './packager';
import { BusinessError, CustomizationError } from '../errors';
import { Agent } from '../types';

const customizationPath = path.resolve(distPath, 'index.js');

function loadCustomization(agent: Agent): void {
  // eslint-disable-next-line
  const customization = require(customizationPath);
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
): Promise<void> {
  const agent = buildAgent(introspection);

  if (fs.existsSync(customizationPath)) {
    loadCustomization(agent);
  } else {
    throw new BusinessError(
      `No built customization found at ${customizationPath}. ` +
        'Generating typings from database schema only.\n' +
        'Please run `yarn build` to build the customization.',
    );
  }

  await agent.updateTypesOnFileSystem(typingsPath, 3);
}
