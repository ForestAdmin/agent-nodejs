/* eslint-disable no-await-in-loop */
import { AgentOptions, createAgent } from '@forestadmin/agent';
import { createHubspotDataSource } from '@forestadmin/datasource-hubspot';
import { createReplicaDataSource } from '@forestadmin/datasource-replica';
import axios from 'axios';
import dotenv from 'dotenv';

import createCurrencyApiDataSource from './exchange-rates';
import { Schema } from './typings';

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

  // const { createAgent } = require('@forestadmin/agent');

  // const agent = createAgent({
  //   authSecret: process.env.FOREST_AUTH_SECRET,
  //   envSecret: process.env.FOREST_ENV_SECRET,
  //   isProduction: process.env.NODE_ENV === 'production',
  // });

  agent.addDataSource(
    createReplicaDataSource({
      // Use an in-memory SQLite database for caching.
      // This is only for demonstration purposes, use a persistent database in production.
      cacheInto: 'sqlite::memory:',

      // Load all records from the target API.
      pullDumpHandler: async () => {
        const url = 'https://jsonplaceholder.typicode.com';
        const collections = ['posts', 'comments', 'albums', 'photos', 'users'];
        const entries = [];

        for (const collection of collections) {
          const response = await axios.get(`${url}/${collection}`);
          entries.push(...response.data.map(record => ({ collection, record })));
        }

        return {
          more: false, // This API does not uses pagination, we can set this to false.
          entries, // The list of records to keep in cache.
        };
      },

      createRecord: async (collectionName, record) => {},
      updateRecord: async (collectionName, record) => {},
      deleteRecord: async (collectionName, record) => {},
    }),
  );

  agent.addDataSource(
    createHubspotDataSource({
      accessToken: process.env.HUBSPOT_ACCESS_TOKEN,
      collections: {
        contacts: ['firstname', 'lastname', 'mycustomfield'],
      },
    }),
    { rename: collectionName => `hubspot_${collectionName}` },
  );

  agent.addDataSource(createCurrencyApiDataSource(7));

  agent.mountOnStandaloneServer(Number(process.env.HTTP_PORT_STANDALONE));
  await agent.start();
};
