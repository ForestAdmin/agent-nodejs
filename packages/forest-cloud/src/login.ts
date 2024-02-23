import { exec } from 'child_process';

import { Logger } from './types';

export default async function login({ spinner, log, error }: Logger) {
  spinner.stop();

  return new Promise<void>((resolve, reject) => {
    const pathForest = require.resolve('forest-cli/bin/run');
    const process = exec(`node ${pathForest} login`);
    process.stdout.on('data', log);
    process.stderr.on('data', error);
    process.on('close', () => {
      spinner.start();
      resolve();
    });
    process.on('error', reject);
  });
}
