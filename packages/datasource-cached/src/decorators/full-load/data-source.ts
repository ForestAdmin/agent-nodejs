import { DataSource, DataSourceDecorator } from '@forestadmin/datasource-toolkit';
import { Sequelize } from 'sequelize';

import FullLoadCollectionDecorator from './collection';
import { FullLoadOptions } from '../../types';

export default class FullLoadDataSourceDecorator extends DataSourceDecorator {
  connection: Sequelize;
  options: FullLoadOptions;

  constructor(childDataSource: DataSource, connection: Sequelize, options: FullLoadOptions) {
    super(childDataSource, FullLoadCollectionDecorator);

    this.connection = connection;
    this.options = options;
  }
}
