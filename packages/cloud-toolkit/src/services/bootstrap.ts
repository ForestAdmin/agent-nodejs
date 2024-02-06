import AdmZip from 'adm-zip';
import axios from 'axios';
import * as fs from 'fs';
import * as fsP from 'fs/promises';
import { homedir } from 'node:os';
import * as os from 'os';
import path from 'path';

import HttpForestServer from './http-forest-server';
import updateTypings from './update-typings';
import { BusinessError } from '../errors';

const downloadUrl = 'https://github.com/ForestAdmin/cloud-customizer/archive/main.zip';
const zipPath = path.join(os.tmpdir(), 'cloud-customizer.zip');
const extractedPath = path.join(os.tmpdir(), 'cloud-customizer-main');
const cloudCustomizerPath = path.join('.', 'cloud-customizer');
const typingsPath = path.join(cloudCustomizerPath, 'typings.d.ts');
const indexPath = path.join(cloudCustomizerPath, 'src', 'index.ts');
const envPath = path.join(cloudCustomizerPath, '.env');
const dotEnvTemplatePath = path.join(__dirname, '..', 'templates', 'env.txt');
const helloWorldTemplatePath = path.join(__dirname, '..', 'templates', 'hello-world.txt');

export const typingsPathAfterBootstrapped = path.join('typings.d.ts');

async function tryToClearBootstrap(): Promise<void> {
  const removeCloudCustomizer = async () => {
    try {
      // we want to throw if the folder is not removed
      await fsP.rm(cloudCustomizerPath, { force: false, recursive: true });
    } catch (e) {
      console.log(`Please remove cloud-customizer folder and re-run bootstrap command.`);
    }
  };

  await Promise.all([
    fsP.rm(zipPath, { force: true }),
    fsP.rm(extractedPath, { force: true, recursive: true }),
    removeCloudCustomizer(),
  ]);
}

async function generateDotEnv(envSecret: string) {
  const envTemplate = await fsP.readFile(dotEnvTemplatePath, 'utf-8');
  let replaced = envTemplate.replace('<FOREST_ENV_SECRET_TO_REPLACE>', envSecret);
  replaced = replaced.replace('<TOKEN_PATH_TO_REPLACE>', homedir());
  await fsP.writeFile(envPath, replaced);
}

async function generateHelloWorldExample(collectionName: string) {
  const template = await fsP.readFile(helloWorldTemplatePath, 'utf-8');
  const replaced = template.replace('<COLLECTION_NAME_TO_REPLACE>', collectionName);
  await fsP.writeFile(indexPath, replaced);
}

export default async function bootstrap(
  envSecret: string,
  httpForestServer: HttpForestServer,
): Promise<void> {
  if (fs.existsSync(cloudCustomizerPath)) {
    throw new BusinessError('You have already a cloud-customizer folder.');
  }

  try {
    const response = await axios({ url: downloadUrl, method: 'get', responseType: 'stream' });

    const stream: fs.WriteStream = fs.createWriteStream(zipPath);
    response.data.pipe(stream);

    await new Promise<void>((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });

    const zip: AdmZip = new AdmZip(zipPath);
    zip.extractAllTo(os.tmpdir(), false);
    await Promise.all([
      fsP.rename(extractedPath, cloudCustomizerPath),
      fsP.rm(zipPath, { force: true }),
    ]);

    // create the .env file if it does not exist
    // we do not overwrite it because it may contain sensitive data
    if (!fs.existsSync(envPath)) await generateDotEnv(envSecret);

    const introspection = await httpForestServer.getIntrospection();

    if (introspection.length !== 0) await generateHelloWorldExample(introspection[0].name);

    await updateTypings(typingsPath, introspection);
  } catch (error) {
    await tryToClearBootstrap();
    throw new BusinessError(`Bootstrap failed: ${error.message}`);
  }
}