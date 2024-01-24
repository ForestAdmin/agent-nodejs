import type { AgentOptions } from '@forestadmin/agent';

import { createAgent } from '@forestadmin/agent';
import { createSqlDataSource } from '@forestadmin/datasource-sql';
import * as fs from 'fs';
import path from 'path';

export default async function generateOrUpdateTypings(fileName: string) {
  const agentOptions: AgentOptions = {
    authSecret: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    envSecret: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    isProduction: false,
  };
  const agent = createAgent(agentOptions);

  // TODO actually get the introspection from api
  const introspection = JSON.parse(
    fs.readFileSync(path.join(path.resolve(), 'introspection-sample.json'), 'utf8'),
  );
  agent.addDataSource(createSqlDataSource(`sqlite::memory:`, introspection));

  agent.updateTypesOnFileSystem(fileName, 5);
}
