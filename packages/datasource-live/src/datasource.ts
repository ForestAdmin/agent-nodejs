import { Sequelize } from 'sequelize';

import { DataSource, DataSourceSchema } from '@forestadmin/datasource-toolkit';

import LiveCollection from './collection';

export default class LiveDataSource implements DataSource {
  private sequelize = null;
  readonly collections: LiveCollection[] = [];

  constructor(dataSourceSchema: DataSourceSchema) {
    this.sequelize = new Sequelize('sqlite::memory:', { logging: false });
    this.collections = Object.entries(dataSourceSchema.collections).map(
      ([name, schema]) => new LiveCollection(name, this, schema, this.sequelize),
    );
  }

  getCollection(name: string): LiveCollection {
    return this.collections.find(collection => collection.name === name) || null;
  }

  async syncCollections(): Promise<boolean> {
    return Promise.all(this.collections.map(collection => collection.sync())).then(() => true);
  }
}
