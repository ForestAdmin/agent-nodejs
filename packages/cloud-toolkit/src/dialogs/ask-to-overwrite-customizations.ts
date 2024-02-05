import readline from 'readline';

import HttpForestServer from '../services/http-forest-server';

export default async function askToOverwriteCustomizations(
  httpForestServer: HttpForestServer,
): Promise<boolean> {
  const lastPublishedCodeDetails = await httpForestServer.getLastPublishedCodeDetails();

  if (lastPublishedCodeDetails === null) return true;

  const {
    relativeDate,
    user: { name, email },
  } = lastPublishedCodeDetails;

  console.warn('\n/!\\ There is already deployed customization code on your project:');
  console.log(`\n  - Last code pushed ${relativeDate}, by ${name} (${email}).\n`);

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
