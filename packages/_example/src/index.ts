import { AgentOptions, createAgent } from '@forestadmin/agent';
import { createHubspotDataSource } from '@forestadmin/datasource-hubspot';
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

  // agent.addDataSource(
  //   createCachedDataSource<string>({
  //     namespace: 'typicode',
  //     cacheUrl: 'postgres://mabasesurneon',
  //     upgradeStategy: ['on-access', 'on-start', 'on-interval'],
  //     schema: async () => [
  //       { collection: 'posts', columns: [{ name: 'title', type: 'string' }] },
  //     ],
  //     getChanges: async (collectionName, state) => {
  //       const response = await axios.get(`http://typicode.com/${collectionName}?sort=updatedAt&limit=100&updatedAt_gte=${state}`);

  //       return {
  //         done: response.data.length < 100,
  //         newOrUpdatedRecords: response.data,
  //         deletedRecords: [],
  //         state: response.data.at(-1)?.updatedAt ?? state,
  //       }
  //     },
  //     createRecord: async (collectionName, record) => {
  //       await axios.post(`http://typicode.com/${collectionName}`, record);
  //     }
  //   })
  // )

  agent.mountOnStandaloneServer(Number(process.env.HTTP_PORT_STANDALONE));
  await agent.start();
};
