import { connectRemoteDataSource } from '@forestadmin/datasource-rpc';
import { createAgent } from '@forestadmin/agent';

import { Schema } from './typings';

export default async () =>
  createAgent<Schema>({
    isProduction: false,
    loggerLevel: 'Info',
    typingsPath: 'src/forest/typings.ts',
  })
    .addDataSource(
      connectRemoteDataSource('http://aa88-2a01-cb0c-85c4-da00-dc2f-e8eb-1743-f32f.ngrok.io'),
    )

    .startAgentServer({
      authSecret: process.env.FOREST_AUTH_SECRET,
      agentUrl: process.env.FOREST_AGENT_URL,
      envSecret: process.env.FOREST_ENV_SECRET,
      forestServerUrl: process.env.FOREST_SERVER_URL,
      mountPoint: {
        type: 'standalone',
        port: Number(process.env.HTTP_PORT_STANDALONE),
      },
    });
