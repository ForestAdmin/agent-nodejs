import AdmZip from 'adm-zip';
import fs from 'fs/promises';
import path from 'path';

import { BusinessError } from '../errors';

export const zipPath = path.join('dist', 'code-customizations.zip');
export const distPath = path.join('dist', 'code-customizations');

export default async function packageCustomizations() {
  const zip: AdmZip = new AdmZip();

  try {
    await fs.access(distPath);
  } catch (e) {
    throw new BusinessError(
      `Failed to access directory ${distPath} containing built code:
      ${e.message}
      Please build your code first.`,
    );
  }

  zip.addLocalFolder(distPath, path.join('nodejs', 'customization'));
  await zip.writeZipPromise(zipPath, { overwrite: true });
}
