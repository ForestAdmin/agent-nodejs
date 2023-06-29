import { AgentOptions, createAgent } from '@forestadmin/agent';
import { createCachedDataSource } from '@forestadmin/datasource-cached';
import { createHubspotDataSource } from '@forestadmin/datasource-hubspot';
import axios from 'axios';
import dotenv from 'dotenv';

import { Schema } from './typings';

dotenv.config();

export default async () => {
  // Make and mount agent.
  const envOptions: AgentOptions = {
    authSecret: process.env.FOREST_AUTH_SECRET,
    envSecret: process.env.FOREST_ENV_SECRET,
    forestServerUrl: process.env.FOREST_SERVER_URL,
    isProduction: false,
    loggerLevel: 'Info',
    typingsPath: 'src/typings.ts',
  };

  const agent = createAgent<Schema>(envOptions);

  agent.addDataSource(
    createHubspotDataSource({
      accessToken: process.env.HUBSPOT_ACCESS_TOKEN,
      collections: {
        contacts: ['firstname', 'lastname', 'mycustomfield'],
      },
    }),
  );

  agent.addDataSource(
    createCachedDataSource({
      cacheInto: 'sqlite::memory:',
      namespace: 'typicode',
      dumpOnStartup: true,
      getDump: async () => {
        const collections = ['users', 'posts', 'comments', 'albums', 'photos', 'todos'];
        const promises = collections.map(async collection => {
          const response = await axios.get(`https://jsonplaceholder.typicode.com/${collection}`);

          return response.data.map(record => ({ collection, record }));
        });
        const records = await Promise.all(promises);

        return { more: false, entries: records.flat() };
      },
    }),
  );

  agent.mountOnStandaloneServer(Number(process.env.HTTP_PORT_STANDALONE));
  await agent.start();
};
