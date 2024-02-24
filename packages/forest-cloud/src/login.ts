import { exec } from 'child_process';

import { Logger } from './types';

export default async function login(logger: Logger) {
  return new Promise<void>((resolve, reject) => {
    let hasLoginSuccess = false;
    const pathForest = require.resolve('forest-cli/bin/run');
    const process = exec(`node ${pathForest} login`);
    process.stderr.on('data', logger.error);

    process.stdout.on('data', data => {
      if (data.includes('Login successful')) hasLoginSuccess = true;
      logger.log(data);
    });

    process.on('close', () => {
      if (!hasLoginSuccess) return reject(new Error('Login failed'));
      resolve();
    });
  });
}
