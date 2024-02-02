import type { AgentOptions } from '@forestadmin/agent';

import { createAgent } from '@forestadmin/agent';
import { createSqlDataSource } from '@forestadmin/datasource-sql';
import fs from 'fs/promises';
import path from 'path';

import HttpForestServer from './http-forest-server';
import { CustomizationError } from '../errors';

export default async function updateTypings(
  httpForestServer: HttpForestServer,
  typingsPath: string,
  rootPath = '.',
) {
  const agentOptions: AgentOptions = {
    authSecret: 'a'.repeat(64),
    envSecret: 'a'.repeat(64),
    loggerLevel: 'Error',
    isProduction: false,
  };
  const agent = createAgent(agentOptions);
  agent.addDataSource(
    createSqlDataSource(`sqlite::memory:`, {
      introspection: await httpForestServer.getIntrospection(),
    }),
  );

  const builtCustomizationPath = `${path.resolve(rootPath)}/dist/code-customizations/index.js`;

  try {
    await fs.access(builtCustomizationPath);

    try {
      // eslint-disable-next-line max-len
      // eslint-disable-next-line import/no-dynamic-require, global-require, @typescript-eslint/no-var-requires
      const customizer = require(builtCustomizationPath).default;
      customizer(agent);
    } catch (customizationError) {
      const error: Error = customizationError;
      throw new CustomizationError(
        `Issue with customizations: ${error.name}\n${error.message}, ${error.stack}`,
      );
    }
  } catch (e) {
    if (e instanceof CustomizationError) throw e;
    console.warn(
      // eslint-disable-next-line max-len
      `No built customization found at ${builtCustomizationPath}. Generating typings from database schema only`,
    );
  }

  await agent.updateTypesOnFileSystem(typingsPath, 3);
}
