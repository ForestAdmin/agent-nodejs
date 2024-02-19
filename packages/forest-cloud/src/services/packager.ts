import AdmZip from 'adm-zip';
import path from 'path';

import { throwIfNoBuiltCode } from './access-file';
import DistPathManager from './dist-path-manager';

export default async function packageCustomizations(distPathManager: DistPathManager) {
  const { zip: zipPath, distCodeCustomizations: distPath } = distPathManager;
  await throwIfNoBuiltCode(distPath);
  const zip: AdmZip = new AdmZip();
  zip.addLocalFolder(distPath, path.join('nodejs', 'customization'));
  await zip.writeZipPromise(zipPath, { overwrite: true });
}
