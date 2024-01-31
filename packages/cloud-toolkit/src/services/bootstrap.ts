import AdmZip from 'adm-zip';
import axios from 'axios';
import * as fs from 'fs';
import { homedir } from 'node:os';
import * as os from 'os';
import path from 'path';

const downloadUrl = 'https://github.com/ForestAdmin/cloud-customizer/archive/main.zip';
const zipPath = path.join(os.tmpdir(), 'cloud-customizer.zip');
const extractedPath = path.join(os.tmpdir(), 'cloud-customizer-main');

export default async function bootstrap(envSecret: string): Promise<void> {
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
    fs.renameSync(path.join(extractedPath), path.join('.', 'cloud-customizer'));
    fs.unlinkSync(zipPath);

    // create the .env file if it does not exist
    // we do not overwrite it because it may contain sensitive data
    if (!fs.existsSync(path.join('.', 'cloud-customizer', '.env'))) {
      fs.writeFileSync(
        './cloud-customizer/.env',
        `FOREST_ENV_SECRET=${envSecret}
TOKEN_PATH=${homedir()}`,
      );
    }
  } catch (error) {
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    // remove the extracted folder if it exists because it may be corrupted
    if (fs.existsSync(extractedPath)) fs.unlinkSync(extractedPath);
    throw new Error(`❌ Bootstrap failed: ${error.message}`);
  }
}
