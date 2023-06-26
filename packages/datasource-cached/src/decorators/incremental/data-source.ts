import { DataSource, DataSourceDecorator } from '@forestadmin/datasource-toolkit';
import { Sequelize } from 'sequelize';

import IncrementalCollectionDecorator from './collection';
import { IncrementalOptions } from '../../types';

export default class IncrementalDataSourceDecorator extends DataSourceDecorator {
  connection: Sequelize;
  options: IncrementalOptions;

  constructor(childDataSource: DataSource, connection: Sequelize, options: IncrementalOptions) {
    super(childDataSource, IncrementalCollectionDecorator);

    this.connection = connection;
    this.options = options;
  }
}
