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
    loggerLevel: 'Info',
    typingsPath: 'src/typings.ts',
  };

  const agent = createAgent<Schema>(envOptions);

  agent.addDataSource(
    createCachedDataSource({
      cacheInto: 'sqlite::memory:',
      cacheNamespace: 'whatever',
      dumpOnStartup: true,
      flattenOptions: {
        users: { asModels: ['address'] },
        // users: { asFields: ['address.street', 'address.city'], asModels: ['address.zipCodes'] },
      },
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
      getDump: async () => {
        return {
          more: false,
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
      generateCollectionTypes: true,
      typingsPath: 'src/typings-hubspot.ts',
      accessToken: process.env.HUBSPOT_ACCESS_TOKEN,
      collections: {
        companies: ['address', 'description', 'days_to_close', 'city', 'facebookfans'],
        quotes: ['hs_all_assigned_business_unit_ids'],
        deals: ['closed_lost_reason', 'closed_won_reason'],
        contacts: ['city', 'annualrevenue'],
      },
    }),
    { rename: collectionName => `hubspot_${collectionName}` },
  );

  agent.addDataSource(
    createCachedDataSource({
      cacheInto: 'sqlite::memory:',
      cacheNamespace: 'typicode',
      dumpOnStartup: true,
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
      getDump: async request => {
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
