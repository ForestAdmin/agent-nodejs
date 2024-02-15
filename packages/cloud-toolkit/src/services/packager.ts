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
      `--- Please build your code first ---
      Failed to access directory ${distPath} containing built code:
      ${e.message}`,
    );
  }

  const zip: AdmZip = new AdmZip();
  zip.addLocalFolder(distPath, path.join('nodejs', 'customization'));
  await zip.writeZipPromise(zipPath, { overwrite: true });
}
