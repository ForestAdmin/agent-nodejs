import latestVersion from 'latest-version';
import { Ora } from 'ora';

import { CloudToolkitVersionError } from '../errors';

export default async function checkLatestVersion(
  spinner: Ora,
  customerVersion: string,
): Promise<void> {
  let version: string;

  try {
    version = await latestVersion('@forestadmin/cloud-toolkit');
  } catch (e) {
    spinner.info('Unable to check the latest version of @forestadmin/cloud-toolkit');

    return;
  }

  // if major version is different
  if (version.split('.')[0] !== customerVersion.split('.')[0]) {
    throw new CloudToolkitVersionError(
      `Your version of @forestadmin/cloud-toolkit is outdated. Latest version is ${version}. ` +
        'Please update it to the latest major version to be able to use our services.',
    );
  } else if (customerVersion !== version) {
    spinner.warn(
      `Your version of @forestadmin/cloud-toolkit is outdated. Latest version is ${version}. ` +
        'Please update it.',
    );
  }
}
