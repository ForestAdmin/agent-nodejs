import readline from 'readline';

import HttpForestServer from './http-forest-server';

export default async function checkCodeAlreadyDeployed(
  httpForestServer: HttpForestServer,
): Promise<{
  keepGoing: boolean;
}> {
  const lastPublishedCodeDetails = await httpForestServer.getLastPublishedCodeDetails();

  if (lastPublishedCodeDetails === null) return { keepGoing: true };

  const days = Math.floor(
    (Date.now() - new Date(lastPublishedCodeDetails.date).getTime()) / (1000 * 3600 * 24),
  );
  let dayString = `${days} days ago`;

  if (days === 0) {
    dayString = 'today';
  } else if (days === 1) {
    dayString = 'yesterday';
  }

  const { name, email } = lastPublishedCodeDetails.user;

  console.warn('\n/!\\ There is already deployed customization code on your project:');
  console.log(`\n  - Last code pushed ${dayString}, by ${name} (${email}).\n`);

  return new Promise(resolve => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(`Do you really want to overwrite these customizations? (yes/no) `, answer => {
      if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
        resolve({ keepGoing: false });
      }

      rl.close();
      resolve({ keepGoing: true });
    });
  });
}
