import { DataSource, DataSourceDecorator } from '@forestadmin/datasource-toolkit';

import WriteCollectionDecorator from './collection';
import { ResolvedOptions } from '../../types';

export default class WriteDataSourceDecorator extends DataSourceDecorator {
  options: ResolvedOptions;

  constructor(childDataSource: DataSource, options: ResolvedOptions) {
    super(childDataSource, WriteCollectionDecorator);

    this.options = options;

    if (
      options.flattenOptions &&
      (options.createRecord || options.updateRecord || options.deleteRecord)
    ) {
      throw new Error('Cannot use flattenOptions with createRecord, updateRecord or deleteRecord');
    }
  }
}
