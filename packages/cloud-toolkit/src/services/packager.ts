import AdmZip from 'adm-zip';
import path from 'path';

export default async function packageCustomizations() {
  const zip: AdmZip = new AdmZip();
  zip.addLocalFolder(path.join('dist'));
  await zip.writeZipPromise(path.join('dist', 'code-customizations.zip'));
}
