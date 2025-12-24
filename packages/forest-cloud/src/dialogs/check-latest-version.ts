import type HttpServer from '../services/http-server';
import type { Spinner } from '../types';

import { CloudToolkitVersionError } from '../errors';

export default async function checkLatestVersion(
  spinner: Spinner,
  customerVersion: string,
  getLatestVersion: typeof HttpServer.getLatestVersion,
): Promise<void> {
  let version: string;

  try {
    version = await getLatestVersion('@forestadmin/forest-cloud');
  } catch (e) {
    spinner.info('Unable to check the latest version of @forestadmin/forest-cloud');

    return;
  }

  // if major version is different
  if (version.split('.')[0] !== customerVersion.split('.')[0]) {
    throw new CloudToolkitVersionError(
      `Your version of @forestadmin/forest-cloud is outdated. Latest version is ${version}.` +
        '\nPlease update it to the latest major version to be able to use our services.',
    );
  } else if (customerVersion !== version) {
    spinner.warn(
      `Your version of @forestadmin/forest-cloud is outdated. Latest version is ${version}.` +
        '\nPlease update it.',
    );
  }
}
