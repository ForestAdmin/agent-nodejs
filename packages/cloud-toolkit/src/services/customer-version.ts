import { readFile } from 'node:fs/promises';

export default async function getCustomerVersion(): Promise<string> {
  const packageJson = JSON.parse(await readFile('package.json', 'utf-8'));

  return packageJson.devDependencies['@forestadmin/cloud-toolkit'];
}
