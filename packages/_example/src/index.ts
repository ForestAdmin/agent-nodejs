import dotenv from 'dotenv';

import makeAgent from './forest/agent';

dotenv.config();

export default async () => {
  // Make and mount agent
  try {
    await makeAgent();
  } catch (e) {
    console.log(e);
  }
};
