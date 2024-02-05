import type { AgentOptions } from '@forestadmin/agent';

import { createAgent } from '@forestadmin/agent';
import { Table, createSqlDataSource } from '@forestadmin/datasource-sql';

export default async function updateTypings(typingsPath: string, introspection: Table[]) {
  const agentOptions: AgentOptions = {
    authSecret: 'a'.repeat(64),
    envSecret: 'a'.repeat(64),
    loggerLevel: 'Error',
    isProduction: false,
  };
  const agent = createAgent(agentOptions);
  agent.addDataSource(createSqlDataSource(`sqlite::memory:`, { introspection }));
  await agent.updateTypesOnFileSystem(typingsPath, 3);
}
