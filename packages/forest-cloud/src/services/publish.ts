import type DistPathManager from './dist-path-manager';
import type HttpServer from './http-server';

import AdmZip from 'adm-zip';
import FormData from 'form-data';

import { BusinessError } from '../errors';

function getKeyFromPolicy(policy: string) {
  const decoded = JSON.parse(Buffer.from(policy.split('.')[0], 'base64').toString());
  const keyCondition = decoded.conditions?.find(
    condition =>
      Array.isArray(condition) && condition[0] === 'starts-with' && condition[1] === '$key',
  );

  return keyCondition[2];
}

export default async function publish(
  httpServer: HttpServer,
  distPathManager: DistPathManager,
): Promise<string> {
  try {
    let buffer: Buffer;
    const zipPath = distPathManager.zip;

    try {
      const zip: AdmZip = new AdmZip(zipPath);
      buffer = zip.toBuffer();
    } catch (error) {
      throw new BusinessError(
        `Cannot read code-customization zip file - At path: ${zipPath}\n ${error.message}`,
      );
    }

    const { url, fields } = await httpServer.postUploadRequest(buffer.byteLength);

    const form = new FormData();
    // The key could either be in the fields or in the fields.Policy
    form.append('key', fields.key || getKeyFromPolicy(fields.Policy));
    Object.entries(fields).forEach(([field, value]) => {
      // Doesn't append it twice
      if (field !== 'key') {
        form.append(field, value);
      }
    });
    form.append('file', buffer);

    await new Promise((resolve, reject) => {
      form.submit(url, (err, res) => {
        if (err) {
          reject(err);
        }

        if (res.statusCode === 200 || res.statusCode === 204) {
          resolve(res.statusCode);
        }

        reject(new Error(res.statusMessage));
      });
    });

    const { subscriptionId } = await httpServer.postPublish();

    return subscriptionId;
  } catch (error) {
    throw new BusinessError(`Publish failed: ${error.message}`);
  }
}
