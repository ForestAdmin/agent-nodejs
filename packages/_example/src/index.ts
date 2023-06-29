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
      schema: [
        {
          name: 'posts',
          fields: {
            userId: { type: 'Column', columnType: 'Number' },
            id: { type: 'Column', columnType: 'Number', isPrimaryKey: true },
            title: { type: 'Column', columnType: 'String' },
            body: { type: 'Column', columnType: 'String' },
            comments: {
              type: 'OneToMany',
              foreignCollection: 'comments',
              originKey: 'postId',
              originKeyTarget: 'id',
            },
          },
        },
        {
          name: 'comments',
          fields: {
            post: {
              type: 'ManyToOne',
              foreignCollection: 'posts',
              foreignKey: 'postId',
              foreignKeyTarget: 'id',
            },
            postId: { type: 'Column', columnType: 'Number' },
            id: { type: 'Column', columnType: 'Number', isPrimaryKey: true },
            name: { type: 'Column', columnType: 'String' },
            email: { type: 'Column', columnType: 'String' },
            body: { type: 'Column', columnType: 'String' },
          },
        },
      ],

      getDump: async request => {
        const records = [];
        const promises = request.collections.map(async collection => {
          const url = `https://jsonplaceholder.typicode.com/${collection}`;
          const response = await axios.get(url);

          records.push(...response.data.map(record => ({ collection, record })));
        });

        await Promise.all(promises);

        return { more: false, entries: records };
      },
      dumpOnStartup: true,
    }),
  );

  agent.mountOnStandaloneServer(Number(process.env.HTTP_PORT_STANDALONE));
  await agent.start();
};
