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
    // loggerLevel: 'Debug',
    loggerLevel: 'Info',
    typingsPath: 'src/typings.ts',
  };

  const agent = createAgent<Schema>(envOptions);

  agent.addDataSource(
    await createHubspotDataSource<TypingsHubspot>({
      cacheInto: 'sqlite:/tmp/mydatabase-67.db',
      skipTypings: false,
      accessToken: process.env.HUBSPOT_ACCESS_TOKEN,
      collections: {
        companies: ['city', 'name', 'country'],
        contacts: ['email', 'firstname', 'lastname'],
        deals: ['description', 'dealstage'],
        line_items: ['hubspot_owner_id'],
        quotes: ['hs_sender_company_name'],
        feedback_submissions: ['hubspot_owner_id'],
        tickets: ['content'],
        testalbans: ['mon_object_perso'],
        forests: ['fieldpro'],
      },
    }),
    { rename: collectionName => `hubspot_${collectionName}` },
  );

  agent.mountOnStandaloneServer(Number(process.env.HTTP_PORT_STANDALONE));
  await agent.start();
};
