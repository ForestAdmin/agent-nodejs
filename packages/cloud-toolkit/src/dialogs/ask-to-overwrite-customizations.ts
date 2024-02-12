import { Ora } from 'ora';
import readline from 'readline';

import HttpForestServer from '../services/http-forest-server';

export default async function askToOverwriteCustomizations(
  spinner: Ora,
  httpForestServer: HttpForestServer,
): Promise<boolean> {
  spinner.start('Checking previous publication');
  const details = await httpForestServer.getLastPublishedCodeDetails();
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
