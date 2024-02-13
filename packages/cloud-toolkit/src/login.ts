import { exec } from 'child_process';
import path from 'path';

import { Spinner } from './types';

export default async function login(spinner: Spinner) {
  spinner.stop();

  return new Promise<void>((resolve, reject) => {
    const pathForest = path.join(__dirname, '..', 'node_modules', '.bin', 'forest');
    const process = exec(`node ${pathForest} login`);
    // eslint-disable-next-line no-console
    process.stdout.on('data', console.log);
    process.stderr.on('data', console.error);
    process.on('close', () => {
      spinner.start();
      resolve();
    });
    process.on('error', reject);
  });
}
