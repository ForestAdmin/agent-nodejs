import type { AgentOptions } from '@forestadmin/agent';

import { createAgent } from '@forestadmin/agent';
import { createSqlDataSource } from '@forestadmin/datasource-sql';

import HttpForestServer from './http-forest-server';

export default async function updateTypings(httpForestServer: HttpForestServer) {
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

  await agent.updateTypesOnFileSystem('typings.d.ts', 3);
}
