import askQuestion from './ask-question';
import displayCustomizationInfo from './display-customization-info';
import HttpServer from '../services/http-server';
import { Spinner } from '../types';

export default async function askToOverwriteCustomizations(
  spinner: Spinner,
  getLastPublishedCodeDetails: typeof HttpServer.prototype.getLastPublishedCodeDetails,
): Promise<boolean> {
  const details = await getLastPublishedCodeDetails();
  if (!details) return true;

  displayCustomizationInfo(spinner, details);
  spinner.info(
    'For the next time, you can publish your customizations with the' +
      ' --force option to skip this step',
  );
  spinner.stop();

  return askQuestion('Do you really want to overwrite these customizations?');
}
