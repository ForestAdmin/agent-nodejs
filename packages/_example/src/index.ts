import dotenv from 'dotenv';
import makeAgent from './forest/agent';

dotenv.config();

export default async () => {
  const agent = makeAgent().mountStandalone(Number(process.env.HTTP_PORT_LOCAL));

  await makeAgent().start();

  return () => agent.stop();
};
