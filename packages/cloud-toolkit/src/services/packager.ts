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
      // eslint-disable-next-line max-len
      'Failed to find ./dist/code-customizations directory containing built code. Please run the build command first.',
    );
  }

  zip.addLocalFolder(distPath, 'nodejs/customization');
  await zip.writeZipPromise(path.join('dist', 'code-customizations.zip'));
}
