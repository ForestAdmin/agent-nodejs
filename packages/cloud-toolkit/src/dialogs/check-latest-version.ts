import { CloudToolkitVersionError } from '../errors';
import HttpServer from '../services/http-server';
import { Spinner } from '../types';

export default async function checkLatestVersion(
  spinner: Spinner,
  customerVersion: string,
  getLatestVersion: typeof HttpServer.getLatestVersion,
): Promise<void> {
  let version: string;

  try {
    version = await getLatestVersion('@forestadmin/cloud-toolkit');
  } catch (e) {
    spinner.info('Unable to check the latest version of @forestadmin/cloud-toolkit');

    return;
  }

  // if major version is different
  if (version.split('.')[0] !== customerVersion.split('.')[0]) {
    throw new CloudToolkitVersionError(
      `Your version of @forestadmin/cloud-toolkit is outdated. Latest version is ${version}.` +
        '\nPlease update it to the latest major version to be able to use our services.',
    );
  } else if (customerVersion !== version) {
    spinner.warn(
      `Your version of @forestadmin/cloud-toolkit is outdated. Latest version is ${version}.` +
        '\nPlease update it.',
    );
  }
}
