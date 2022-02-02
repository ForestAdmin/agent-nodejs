import dotenv from 'dotenv';
import http from 'http';
import makeAgent from './agent';

dotenv.config();

export default async function start() {
  const agent = makeAgent({
    logger: console.log, // eslint-disable-line no-console
    prefix: process.env.FOREST_PREFIX,
    authSecret: process.env.FOREST_AUTH_SECRET,
    agentUrl: process.env.FOREST_AGENT_URL,
    envSecret: process.env.FOREST_ENV_SECRET,
    forestServerUrl: process.env.FOREST_SERVER_URL,
    isProduction: false,
    schemaPath: '.forestadmin-schema.json',
  });

  await agent.start();

  const server = http.createServer(agent.httpCallback);
  const host = process.env.SERVER_HOST;
  const port = Number(process.env.SERVER_PORT);
  await new Promise<void>(resolve => {
    server.listen(port, host, null, () => {
      resolve();
    });
  });

  return () => {
    server.close();
  };
}
