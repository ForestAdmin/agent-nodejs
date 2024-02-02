import AdmZip from 'adm-zip';
import fs from 'fs/promises';
import path from 'path';

import { BusinessError } from '../errors';

export default async function packageCustomizations() {
  const zip: AdmZip = new AdmZip();
  const distPath = path.join('dist', 'code-customizations');

  try {
    await fs.access(distPath);
  } catch (e) {
    throw new BusinessError(
      `Failed to access directory ${distPath} containing built code:
      ${e.message}
      Please build your code first.`,
    );
  }

  zip.addLocalFolder(distPath, 'nodejs/customization');
  await zip.writeZipPromise(path.join('dist', 'code-customizations.zip'), { overwrite: true });
}
