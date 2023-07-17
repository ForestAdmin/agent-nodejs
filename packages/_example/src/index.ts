import { AgentOptions, createAgent } from '@forestadmin/agent';
import { createCachedDataSource } from '@forestadmin/datasource-cached';
import { createHubspotDataSource } from '@forestadmin/datasource-hubspot';
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

  agent.addDataSource(
    createCachedDataSource({
      cacheInto: 'sqlite:./database.sqlite',
      cacheNamespace: 'whatever',
      flattenMode: 'auto',
      schema: [
        {
          name: 'users',
          fields: {
            id: { type: 'Integer', isPrimaryKey: true },
            name: { type: 'String' },
            address: {
              street: { type: 'String' },
              // city: { type: 'String' },
              zipCodes: [{ type: 'Integer' }],
            },
          },
        },
      ],
      // pullDeltaOnBeforeAccess: true,
      pullDumpHandler: async () => {
        return {
          more: false,
          nextDeltaState: null,
          entries: [
            {
              collection: 'users',
              record: {
                id: 1,
                name: 'John Doe',
                address: { street: '123 Main St', city: 'San Francisco', zipCodes: [94105, 94107] },
              },
            },
            {
              collection: 'users',
              record: {
                id: 2,
                name: 'John Doe',
                address: { street: '456 Main St', city: 'San Francisco', zipCodes: [94105, 94107] },
              },
            },
          ],
        };
      },
      // createRecord: async (collectionName, record) => {
      //   console.log('create', collectionName, record);

      //   return { id: 1, ...record };
      // },
      // updateRecord: async (collectionName, record) => {
      //   console.log('update', collectionName, record);

      //   return record;
      // },
      // deleteRecord: async (collectionName, record) => {
      //   console.log('delete', collectionName, record);
      // },
    }),
    { rename: collectionName => `whatever_${collectionName}` },
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
