import { DataSource, DataSourceDecorator } from '@forestadmin/datasource-toolkit';

import WriteCollectionDecorator from './collection';
import { ResolvedOptions } from '../../types';

export default class WriteDataSourceDecorator extends DataSourceDecorator {
  options: ResolvedOptions;

  constructor(childDataSource: DataSource, options: ResolvedOptions) {
    super(childDataSource, WriteCollectionDecorator);

    this.options = options;
  }
}
