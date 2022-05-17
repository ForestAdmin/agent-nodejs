import { AgentOptions } from '@forestadmin/agent';
import dotenv from 'dotenv';
import makeAgent from './agent';

dotenv.config();

const envHost: string = process.env.SERVER_HOST;
const envPort = Number(process.env.SERVER_PORT);
const envOptions: AgentOptions = {
  authSecret: process.env.FOREST_AUTH_SECRET,
  agentUrl: process.env.FOREST_AGENT_URL,
  envSecret: process.env.FOREST_ENV_SECRET,
  forestServerUrl: process.env.FOREST_SERVER_URL,
  isProduction: false,
  loggerLevel: 'Info',
  typingsPath: 'src/typings.ts',
};

export default async function start(
  port: number = envPort,
  host: string = envHost,
  options: AgentOptions = envOptions,
) {
  const agent = await makeAgent(options);
  await agent.mountStandalone(port, host).start();

  return () => agent.stop();
}
