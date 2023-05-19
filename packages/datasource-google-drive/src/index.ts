import type { DataSourceFactory, Logger } from '@forestadmin/datasource-toolkit';

import GoogleDriveDataSource, { Options } from './datasource';

export default function createGoogleDriveDataSource(options: Options): DataSourceFactory {
  return async (logger: Logger) => new GoogleDriveDataSource(options, logger);
}
