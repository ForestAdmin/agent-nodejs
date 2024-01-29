import AdmZip from 'adm-zip';
import axios from 'axios';
import * as fs from 'fs';

const downloadUrl = 'https://github.com/ForestAdmin/cloud-customizer/archive/main.zip';
const savePath = './cloud-customizer-main.zip';

export default async function bootstrap() {
  try {
    console.log(`Bootstrap is starting...`);

    const response = await axios({ url: downloadUrl, method: 'get', responseType: 'stream' });

    const stream: fs.WriteStream = fs.createWriteStream(savePath);
    response.data.pipe(stream);

    await new Promise<void>((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });

    console.log(`Code is downloaded.`);

    const zip: AdmZip = new AdmZip(savePath);
    // extract everything
    zip.extractAllTo('.', false);
    // rename cloud-customizer-main to cloud-customizer
    fs.renameSync('./cloud-customizer-main', './cloud-customizer');

    // eslint-disable-next-line no-console
    console.log(`Code is extracted.`);

    // remove zip file
    fs.unlinkSync(savePath);

    console.log(`Bootstrap is done.`);
  } catch (error) {
    console.error('Bootstrap fails:', error.message);
  }
}
