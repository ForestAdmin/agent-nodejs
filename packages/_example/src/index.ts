import dotenv from 'dotenv';
import makeAgent from './forest/agent';

dotenv.config();

export default async () => {
  const agent = makeAgent().mountStandalone(Number(process.env.HTTP_PORT_LOCAL));

  await agent.start();

  return () => agent.stop();
};
