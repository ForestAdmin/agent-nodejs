import { DataSource } from '@forestadmin/datasource-toolkit';
import SequelizeCollection from './collection';

export default abstract class SequelizeDataSource implements DataSource {
  protected sequelize = null;

  readonly collections: SequelizeCollection[] = [];

  constructor(collections: SequelizeCollection[] = []) {
    this.collections = collections;
  }

  getCollection(name: string): SequelizeCollection {
    return this.collections.find(collection => collection.name === name) || null;
  }
}
