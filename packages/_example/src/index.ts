import { AgentOptions, createAgent } from '@forestadmin/agent';
import { createCachedDataSource } from '@forestadmin/datasource-cached';
import { createHubspotDataSource } from '@forestadmin/datasource-hubspot';
import axios from 'axios';
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
    createCachedDataSource({
      cacheInto: 'sqlite::memory:',
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
              city: { type: 'String' },
              zipCodes: [{ type: 'Integer' }],
            },
          },
        },
      ],
      pullDeltaOnBeforeAccess: true,
      pullDeltaHandler: async () => {
        return {
          more: false,
          nextDeltaState: null,
          deletedEntries: [],
          newOrUpdatedEntries: [
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
            {
              collection: 'users',
              record: {
                id: 3,
                name: 'John Doe',
                address: { street: '789 Main St', city: 'San Francisco', zipCodes: [94105, 94107] },
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
    await createHubspotDataSource<TypingsHubspot>({
      cacheInto: 'sqlite:/tmp/mydatabase-3.db',
      skipTypings: false,
      typingsPath: 'src/typings-hubspot.ts',
      accessToken: process.env.HUBSPOT_ACCESS_TOKEN,
      collections: {
        companies: ['description', 'days_to_close', 'city', 'owneremail', 'state'],
        deals: ['description'],
        contacts: ['country'],
        line_items: ['amount'],
      },
    }),
    { rename: collectionName => `hubspot_${collectionName}` },
  );

  agent.addDataSource(
    createCachedDataSource({
      cacheInto: 'sqlite::memory:',
      cacheNamespace: 'typicode',

      schema: [
        {
          name: 'users',
          fields: {
            id: { type: 'Integer', isPrimaryKey: true },
          },
        },
        {
          name: 'posts',
          fields: {
            id: { type: 'Integer', isPrimaryKey: true },
            userId: {
              type: 'Integer',
              reference: {
                relationInverse: 'posts',
                relationName: 'user',
                targetCollection: 'users',
                targetField: 'id',
              },
            },
            title: { type: 'String' },
            body: { type: 'String' },
          },
        },
      ],

      pullDumpOnStartup: true,
      pullDumpHandler: async request => {
        const promises = request.collections.map(async collection => {
          const response = await axios.get(`https://jsonplaceholder.typicode.com/${collection}`);

          return response.data.map(record => ({ collection, record }));
        });
        const records = await Promise.all(promises);

        return { more: false, entries: records.flat() };
      },
    }),
    { rename: collectionName => `typicode_${collectionName}` },
  );

  agent.mountOnStandaloneServer(Number(process.env.HTTP_PORT_STANDALONE));
  await agent.start();
};
