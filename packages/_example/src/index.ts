import { AgentOptions, createAgent } from '@forestadmin/agent';
import { createHubspotDataSource } from '@forestadmin/datasource-hubspot';
import dotenv from 'dotenv';

import { Schema } from './typings';
import { TypingsHubspot } from './typings-hubspot';

dotenv.config();

export default async () => {
  // Make and mount agent.
  const envOptions: AgentOptions = {
    authSecret: process.env.FOREST_AUTH_SECRET,
    envSecret: process.env.FOREST_ENV_SECRET,
    forestServerUrl: process.env.FOREST_SERVER_URL,
    isProduction: false,
    loggerLevel: 'Debug',
    typingsPath: 'src/typings.ts',
  };

  const agent = createAgent<Schema>(envOptions);

  agent.addDataSource(
    await createHubspotDataSource<TypingsHubspot>({
      cacheInto: 'sqlite:/tmp/mydatabase-32.db',
      skipTypings: false,
      typingsPath: 'src/typings-hubspot.ts',
      accessToken: process.env.HUBSPOT_ACCESS_TOKEN,
      collections: {
        companies: ['description', 'days_to_close', 'city', 'owneremail', 'state'],
        deals: ['description'],
        contacts: ['country'],
        line_items: ['amount'],
        flos: ['age'],
        testalbans: ['l_age_de_mon_objet'],
      },
      pullDumpOnTimer: 1000 * 60 * 60 * 2, // 2 hours
    }),
    { rename: collectionName => `hubspot_${collectionName}` },
  );

  agent.mountOnStandaloneServer(Number(process.env.HTTP_PORT_STANDALONE));
  await agent.start();
};
