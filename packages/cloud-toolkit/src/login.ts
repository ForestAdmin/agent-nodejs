import { exec } from 'child_process';
import path from 'path';

import { Logger } from './types';

export default async function login(logger: Logger) {
  logger.spinner.stop();

  return new Promise<void>((resolve, reject) => {
    const pathForest = path.join(__dirname, '..', 'node_modules', '.bin', 'forest');
    const process = exec(`node ${pathForest} login`);
    // eslint-disable-next-line no-console
    process.stdout.on('data', logger.log);
    process.stderr.on('data', logger.error);
    process.on('close', () => {
      logger.spinner.start();
      resolve();
    });
    process.on('error', reject);
  });
}
