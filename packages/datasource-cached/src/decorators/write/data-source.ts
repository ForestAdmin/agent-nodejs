import { DataSource, DataSourceDecorator } from '@forestadmin/datasource-toolkit';

import WriteCollectionDecorator from './collection';
import { CachedDataSourceOptions } from '../../types';

export default class WriteDataSourceDecorator extends DataSourceDecorator {
  options: CachedDataSourceOptions;

  constructor(childDataSource: DataSource, options: CachedDataSourceOptions) {
    super(childDataSource, WriteCollectionDecorator);

    this.options = options;
  }
}
