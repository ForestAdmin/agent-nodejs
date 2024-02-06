import AdmZip from 'adm-zip';
import FormData from 'form-data';
import path from 'path';

import HttpForestServer from './http-forest-server';
import { BusinessError } from '../errors';

const zipPath = path.join('dist', 'code-customizations.zip');

function getKeyFromPolicy(policy: string) {
  const decoded = JSON.parse(Buffer.from(policy.split('.')[0], 'base64').toString());
  const keyCondition = decoded.conditions?.find(
    condition =>
      Array.isArray(condition) && condition[0] === 'starts-with' && condition[1] === '$key',
  );

  return keyCondition[2];
}

export default async function publish(httpForestServer: HttpForestServer): Promise<string> {
  try {
    let buffer: Buffer;

    try {
      const zip: AdmZip = new AdmZip(zipPath);
      buffer = zip.toBuffer();
    } catch (error) {
      throw new BusinessError(
        `Cannot read code-customization zip file - At path: ${zipPath}\n ${error.message}`,
      );
    }

    const { url, fields } = await httpForestServer.postUploadRequest(buffer.byteLength);

    const form = new FormData();
    form.append('key', getKeyFromPolicy(fields.Policy));
    Object.entries(fields).forEach(([field, value]) => {
      form.append(field, value);
    });
    form.append('file', buffer);

    await new Promise((resolve, reject) => {
      form.submit(url, (err, res) => {
        if (err) reject(err);
        resolve(res);
      });
    });

    const { subscriptionId } = await httpForestServer.postPublish();

    console.log('Received subscription id', subscriptionId);

    return subscriptionId;
  } catch (error) {
    throw new BusinessError(`Publish failed: ${error.message}`);
  }
}
