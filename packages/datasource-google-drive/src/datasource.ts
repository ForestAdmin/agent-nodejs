import { BaseDataSource, Logger } from '@forestadmin/datasource-toolkit';

import GoogleDriveCollection from './collection';

export type Options = {
  name?: string;

  /** GOOGLE API keys, defaults to process.env.GOOGLE_API_KEY. */
  auth?: string;

  /** Alternatively, you can specify the path to the service account credential file via */
  // keyFile?: string;
};

export default class GoogleDriveDataSource extends BaseDataSource {
  constructor(options: Options, logger: Logger) {
    super();

    logger?.('Debug', 'Building GoogleDriveCollection...');
    this.addCollection(new GoogleDriveCollection(this, options.name ?? 'GoogleDrive', options));
  }
}
