import { Sequelize } from 'sequelize';

import { Collection, DataSource, DataSourceSchema } from '@forestadmin/datasource-toolkit';

import LiveCollection from './collection';

export default class LiveDataSource implements DataSource {
  private sequelize = null;
  readonly collections: Collection[] = [];

  constructor(dataSourceSchema: DataSourceSchema) {
    this.sequelize = new Sequelize('sqlite::memory:');
    this.collections = Object.entries(dataSourceSchema.collections).map(
      ([name, schema]) => new LiveCollection(name, this, schema, this.sequelize),
    );
  }

  getCollection(name: string): Collection {
    return this.collections.find(collection => collection.name === name) || null;
  }
}
