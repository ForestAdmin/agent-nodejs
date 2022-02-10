import { BaseDataSource } from '@forestadmin/datasource-toolkit';
import { Sequelize } from 'sequelize';

import SequelizeCollection from './collection';

export default class SequelizeDataSource extends BaseDataSource<SequelizeCollection> {
  protected sequelize: Sequelize = null;

  constructor(sequelize: Sequelize) {
    super();

    if (!sequelize) throw new Error('Invalid (null) Sequelize instance.');

    this.sequelize = sequelize;
  }
}
