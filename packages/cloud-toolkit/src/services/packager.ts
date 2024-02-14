import AdmZip from 'adm-zip';
import fs from 'fs/promises';
import path from 'path';

import DistPathManager from './dist-path-manager';
import { BusinessError } from '../errors';

export default async function packageCustomizations(distPathManager: DistPathManager) {
  const { zip: zipPath, distCodeCustomizations: distPath } = distPathManager;

  try {
    await fs.access(distPath);
  } catch (e) {
    throw new BusinessError(
      `Failed to access directory ${distPath} containing built code:
      ${e.message}
      Please build your code first.`,
    );
  }

  const zip: AdmZip = new AdmZip();
  zip.addLocalFolder(distPath, path.join('nodejs', 'customization'));
  await zip.writeZipPromise(zipPath, { overwrite: true });
}
