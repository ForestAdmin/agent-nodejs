import readline from 'readline';

import HttpServer from '../services/http-server';
import { Spinner } from '../types';

export default async function askToOverwriteCustomizations(
  spinner: Spinner,
  httpServer: HttpServer,
): Promise<boolean> {
  const details = await httpServer.getLastPublishedCodeDetails();

  if (!details) return true;

  const { relativeDate, user } = details;

  spinner.warn('There is already deployed customization code on your project');
  spinner.info(`Last code pushed ${relativeDate}, by ${user.name} (${user.email})`);
  spinner.stop();

  return new Promise(resolve => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(`Do you really want to overwrite these customizations? (yes/no) `, answer => {
      if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
        resolve(false);
      }

      rl.close();
      resolve(true);
    });
  });
}
