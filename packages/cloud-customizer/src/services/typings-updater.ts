import type { AgentOptions } from '@forestadmin/agent';

import { createAgent } from '@forestadmin/agent';
import { createSqlDataSource } from '@forestadmin/datasource-sql';
import * as fs from 'fs';

export default async function generateOrUpdateTypings(fileName: string) {
  const agentOptions: AgentOptions = {
    authSecret: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    envSecret: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    isProduction: false,
  };
  const agent = createAgent(agentOptions);

  // TODO actually get the introspection from api
  const introspection = JSON.parse(
    fs.readFileSync('/Users/nicolas/Forest/cloud-customizer/introspection-sample.json', 'utf8'),
  );
  agent.addDataSource(createSqlDataSource(`sqlite::memory:`, introspection));

  agent.updateTypesOnFileSystem(fileName, 5);
}
