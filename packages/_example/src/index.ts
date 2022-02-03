import { ForestAdminHttpDriverOptions } from '@forestadmin/agent';
import dotenv from 'dotenv';
import http from 'http';
import makeAgent from './agent';

dotenv.config();

const envHost = process.env.SERVER_HOST;
const envPort = Number(process.env.SERVER_PORT);
const envConfig: ForestAdminHttpDriverOptions = {
  logger: console.log, // eslint-disable-line no-console
  prefix: process.env.FOREST_PREFIX,
  authSecret: process.env.FOREST_AUTH_SECRET,
  agentUrl: process.env.FOREST_AGENT_URL,
  envSecret: process.env.FOREST_ENV_SECRET,
  forestServerUrl: process.env.FOREST_SERVER_URL,
  isProduction: false,
  schemaPath: '.forestadmin-schema.json',
};

export default async function start(port = envPort, host = envHost, config = envConfig) {
  const agent = makeAgent(config);
  await agent.start();

  const server = http.createServer(agent.httpCallback);
  await new Promise<void>(resolve => {
    server.listen(port, host, null, () => {
      resolve();
    });
  });

  return () => {
    server.close();
  };
}
