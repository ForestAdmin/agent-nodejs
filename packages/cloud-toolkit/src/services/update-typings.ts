import type { AgentOptions } from '@forestadmin/agent';

import { createAgent } from '@forestadmin/agent';
import { createSqlDataSource } from '@forestadmin/datasource-sql';
import * as fs from 'fs';
import path from 'path';

export default async function updateTypings(serverUrl: string | undefined) {
  const server = serverUrl || 'forestadmin.com';
  const agentOptions: AgentOptions = {
    authSecret: 'a'.repeat(64),
    envSecret: 'a'.repeat(64),
    isProduction: false,
  };
  const agent = createAgent(agentOptions);

  const introspection = JSON.parse(
    fs.readFileSync(path.join(path.resolve(), 'introspection-sample.json'), 'utf8'),
  );
  agent.addDataSource(createSqlDataSource(`sqlite::memory:`, introspection));

  await agent.updateTypesOnFileSystem('typings.d.ts', 5);
}
