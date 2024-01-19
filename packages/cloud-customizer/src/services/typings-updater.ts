import type { AgentOptions } from '@forestadmin/agent';

import { createAgent } from '@forestadmin/agent';
import { createSqlDataSource } from '@forestadmin/datasource-sql';
import * as fs from 'fs';

export default async function generateOrUpdateTypings(fileName: string) {
  const agentOptions: AgentOptions = {
    authSecret: 'abc123',
    envSecret: '06e1ec6d25fd58917d5c2384e597294f340ca2029465c510a730f5519716e7a1',
    forestServerUrl: 'https://maison.lamuseauplacard.fr:4430',
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
