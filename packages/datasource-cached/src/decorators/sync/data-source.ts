/* eslint-disable no-await-in-loop */
// eslint-disable-next-line max-classes-per-file
import { DataSource, DataSourceDecorator } from '@forestadmin/datasource-toolkit';

import SyncCollectionDecorator from './collection';
import { ResolvedOptions } from '../../types';

export default class TriggerSyncDataSourceDecorator extends DataSourceDecorator<SyncCollectionDecorator> {
  options: ResolvedOptions;

  constructor(childDataSource: DataSource, options: ResolvedOptions) {
    super(childDataSource, SyncCollectionDecorator);

    this.options = options;
  }
}
