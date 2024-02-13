import { Table } from '@forestadmin/datasource-sql';
import AdmZip from 'adm-zip';
import * as fs from 'fs';
import * as fsP from 'fs/promises';
import * as os from 'os';

import BootstrapPathManager from './bootstrap-path-manager';
import HttpServer from './http-server';
import { updateTypings } from './update-typings';
import { BusinessError } from '../errors';

async function tryToClearBootstrap(paths: BootstrapPathManager): Promise<string | null> {
  try {
    await Promise.all([
      fsP.rm(paths.zip, { force: true }),
      fsP.rm(paths.extracted, { force: true, recursive: true }),
      fsP.rm(paths.cloudCustomizer, { force: false, recursive: true }),
    ]);
  } catch (e) {
    return ` \nPlease remove cloud-customizer folder and re-run bootstrap command.`;
  }
}

async function generateDotEnv(envSecret: string, paths: BootstrapPathManager) {
  const envTemplate = await fsP.readFile(paths.dotEnvTemplate, 'utf-8');
  let replaced = envTemplate.replace('<FOREST_ENV_SECRET_TO_REPLACE>', envSecret);
  replaced = replaced.replace('<TOKEN_PATH_TO_REPLACE>', paths.home);
  await fsP.writeFile(paths.env, replaced);
}

async function generateHelloWorldExample(
  collectionName: string,
  dependency: string,
  paths: BootstrapPathManager,
) {
  const template = await fsP.readFile(paths.helloWorldTemplate, 'utf-8');
  let replaced = template.replace('<COLLECTION_NAME_TO_REPLACE>', collectionName);
  replaced = replaced.replace('<DEPENDENCY_TO_REPLACE>', dependency);
  await fsP.writeFile(paths.index, replaced);
}

function findPrimaryKeyAndCollectionName(introspection: Table[]): {
  collectionName: string;
  primaryKey: string;
} | null {
  for (const collection of introspection) {
    const pk = collection.columns.find(column => column.primaryKey);
    if (pk) return { collectionName: collection.name, primaryKey: pk.name };
  }

  return null;
}

export default async function bootstrap(envSecret: string, httpServer: HttpServer): Promise<void> {
  const paths = new BootstrapPathManager(os.tmpdir(), os.homedir());

  if (fs.existsSync(paths.cloudCustomizer)) {
    throw new BusinessError('You have already a cloud-customizer folder');
  }

  try {
    await HttpServer.downloadCloudCustomizerTemplate(paths.zip);

    const zip: AdmZip = new AdmZip(paths.zip);
    zip.extractAllTo(paths.tmp, false);
    await Promise.all([
      fsP.rename(paths.extracted, paths.cloudCustomizer),
      fsP.rm(paths.zip, { force: true }),
    ]);

    // create the .env file if it does not exist
    // we do not overwrite it because it may contain sensitive data
    if (!fs.existsSync(paths.env)) await generateDotEnv(envSecret, paths);

    const introspection = await httpServer.getIntrospection();
    const data = findPrimaryKeyAndCollectionName(introspection);
    if (data) await generateHelloWorldExample(data.collectionName, data.primaryKey, paths);

    await updateTypings(paths.typings, introspection);
  } catch (error) {
    const potentialErrorMessage = await tryToClearBootstrap(paths);
    throw new BusinessError(`Bootstrap failed: ${error.message}.${potentialErrorMessage || ''}`);
  }
}
