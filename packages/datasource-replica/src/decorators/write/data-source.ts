import type { ResolvedOptions } from '../../types';
import type { DataSource } from '@forestadmin/datasource-toolkit';

import { DataSourceDecorator } from '@forestadmin/datasource-toolkit';

import WriteCollectionDecorator from './collection';

export default class WriteDataSourceDecorator extends DataSourceDecorator {
  options: ResolvedOptions;

  constructor(childDataSource: DataSource, options: ResolvedOptions) {
    super(childDataSource, WriteCollectionDecorator);

    this.options = options;

    if (
      options.flattenOptions &&
      (options.createRecordHandler || options.updateRecordHandler || options.deleteRecordHandler)
    ) {
      throw new Error(
        'Cannot use flattenOptions with createRecordHandler, updateRecordHandler or deleteRecordHandler',
      );
    }
  }
}
