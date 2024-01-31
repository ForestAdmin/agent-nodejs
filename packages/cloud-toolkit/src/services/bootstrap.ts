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

export default async function bootstrap(
  envSecret: string,
  httpForestServer: HttpForestServer,
): Promise<void> {
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
    if (!fs.existsSync(path.join('.', 'cloud-customizer', '.env'))) {
      await fsP.writeFile(
        './cloud-customizer/.env',
        `FOREST_ENV_SECRET=${envSecret}
TOKEN_PATH=${homedir()}`,
      );
    }

    await updateTypings(httpForestServer, path.join('cloud-customizer', 'typings.d.ts'));
  } catch (error) {
    await tryToClearBootstrap();
    throw new BusinessError(`Bootstrap failed: ${error.message}`);
  }
}
