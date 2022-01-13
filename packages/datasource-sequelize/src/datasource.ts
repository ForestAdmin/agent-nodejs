import { BaseDataSource } from '@forestadmin/datasource-toolkit';
import SequelizeCollection from './collection';

export default abstract class SequelizeDataSource extends BaseDataSource<SequelizeCollection> {
  protected sequelize = null;

  constructor(collections: SequelizeCollection[], sequelize) {
    super();

    if (!sequelize) throw new Error('Invalid (null) Sequelize instance.');

    this.sequelize = sequelize;

    collections.forEach(collection => this.addCollection(collection.name, collection));
  }
}
