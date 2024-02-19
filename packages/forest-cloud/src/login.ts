import { exec } from 'child_process';
import path from 'path';

import { Logger } from './types';

export default async function login({ spinner, log, error }: Logger) {
  spinner.stop();

  return new Promise<void>((resolve, reject) => {
    const pathForest = path.join(__dirname, '..', 'node_modules', '.bin', 'forest');
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
