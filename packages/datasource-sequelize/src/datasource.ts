import { Sequelize } from 'sequelize';

import { BaseDataSource } from '@forestadmin/datasource-toolkit';

import SequelizeCollection from './collection';

export default class SequelizeDataSource extends BaseDataSource<SequelizeCollection> {
  protected sequelize: Sequelize = null;

  // TODO: Remove `collections` as it is always passed as `[]`.
  constructor(collections: SequelizeCollection[], sequelize: Sequelize) {
    super();

    if (!sequelize) throw new Error('Invalid (null) Sequelize instance.');

    this.sequelize = sequelize;

    collections.forEach(collection => this.addCollection(collection));
  }
}
