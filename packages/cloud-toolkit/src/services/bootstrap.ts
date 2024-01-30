import AdmZip from 'adm-zip';
import axios from 'axios';
import * as fs from 'fs';
import { homedir } from 'node:os';
import * as os from 'os';
import path from 'path';

const downloadUrl = 'https://github.com/ForestAdmin/cloud-customizer/archive/main.zip';
// get tmp path
const zipPath = path.join(os.tmpdir(), 'cloud-customizer.zip');

export default async function bootstrap(envSecret: string): Promise<void> {
  try {
    console.log(`Bootstrap is starting...`);

    console.log('create a .env file');

    const response = await axios({ url: downloadUrl, method: 'get', responseType: 'stream' });

    const stream: fs.WriteStream = fs.createWriteStream(zipPath);
    response.data.pipe(stream);

    await new Promise<void>((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });

    console.log(`Code is downloaded.`);

    const zip: AdmZip = new AdmZip(zipPath);
    // extract everything
    zip.extractAllTo(os.tmpdir(), false);
    const extractedPath = path.join(os.tmpdir(), 'cloud-customizer-main');
    fs.renameSync(path.join(extractedPath), path.join('.', 'cloud-customizer'));

    console.log(`Code is extracted.`);

    fs.unlinkSync(zipPath);

    // check if file exists
    if (fs.existsSync(path.join('.', 'cloud-customizer', '.env'))) {
      console.log('.env file already exists');
    } else {
      fs.writeFileSync(
        './cloud-customizer/.env',
        `FOREST_ENV_SECRET=${envSecret}
TOKEN_PATH=${homedir()}`,
      );
      console.log('File .env created');
    }

    console.log(`Bootstrap is done.`);
  } catch (error) {
    console.error('Bootstrap fails:', error.message);
  }
}
