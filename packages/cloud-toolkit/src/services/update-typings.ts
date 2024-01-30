import type { AgentOptions } from '@forestadmin/agent';

import { createAgent } from '@forestadmin/agent';
import { createSqlDataSource } from '@forestadmin/datasource-sql';
import path from 'path';

import HttpForestServer from './http-forest-server';

export default async function updateTypings(
  httpForestServer: HttpForestServer,
  typingsPath: string,
) {
  console.log('Update typings is starting...');
  const agentOptions: AgentOptions = {
    authSecret: 'a'.repeat(64),
    envSecret: 'a'.repeat(64),
    isProduction: false,
  };
  const agent = createAgent(agentOptions);
  agent.addDataSource(
    createSqlDataSource(`sqlite::memory:`, {
      introspection: await httpForestServer.getIntrospection(),
    }),
  );
  await agent.updateTypesOnFileSystem(typingsPath, 3);
  console.log(`Update typings is done. The file typings.d.ts has been updated.`);
}
