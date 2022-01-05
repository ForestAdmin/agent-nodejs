import { Sequelize } from 'sequelize';

import { DataSourceSchema } from '@forestadmin/datasource-toolkit';
import { SequelizeDataSource } from '@forestadmin/datasource-sequelize';

import LiveCollection from './collection';

export default class LiveDataSource extends SequelizeDataSource {
  override readonly collections: LiveCollection[] = [];

  constructor(dataSourceSchema: DataSourceSchema) {
    super();

    this.sequelize = new Sequelize('sqlite::memory:', { logging: false });

    this.collections = Object.entries(dataSourceSchema.collections).map(
      ([name, schema]) => new LiveCollection(name, this, schema, this.sequelize),
    );
  }

  async syncCollections(): Promise<boolean> {
    return Promise.all(this.collections.map(collection => collection.sync())).then(() => true);
  }
}
