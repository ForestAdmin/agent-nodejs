import { exec } from 'child_process';

import { Logger } from './types';

export default async function login(logger: Logger) {
  return new Promise<void>((resolve, reject) => {
    const errors: string[] = [];
    const pathForest = require.resolve('forest-cli/bin/run');
    const process = exec(`node ${pathForest} login`);
    process.stdout.on('data', logger.log);
    process.stderr.on('data', data => {
      errors.push(data);
    });

    process.on('close', () => {
      if (errors.length > 0) return reject(new Error(errors.join('\n')));

      resolve();
    });
  });
}
