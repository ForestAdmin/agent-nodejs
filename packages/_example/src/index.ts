import dotenv from 'dotenv';

import agent from './agent';

dotenv.config();

export default async function start() {
  return agent(Number(process.env.SERVER_PORT), process.env.SERVER_HOST, {
    authSecret: process.env.FOREST_AUTH_SECRET,
    agentUrl: process.env.FOREST_AGENT_URL,
    envSecret: process.env.FOREST_ENV_SECRET,
    forestServerUrl: process.env.FOREST_SERVER_URL,
    isProduction: false,
  });
}
