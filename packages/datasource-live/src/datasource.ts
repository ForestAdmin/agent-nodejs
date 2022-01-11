import { Sequelize } from 'sequelize';

import { DataSourceSchema } from '@forestadmin/datasource-toolkit';
import { SequelizeDataSource } from '@forestadmin/datasource-sequelize';

import LiveCollection from './collection';

export default class LiveDataSource extends SequelizeDataSource {
  constructor(dataSourceSchema: DataSourceSchema) {
    super([], new Sequelize('sqlite::memory:', { logging: false }));

    Object.entries(dataSourceSchema.collections).map(([name, schema]) =>
      this.addCollection(name, new LiveCollection(name, this, this.sequelize, schema)),
    );
  }

  async syncCollections(): Promise<boolean> {
    return Promise.all(
      this.collections.map(collection => (collection as LiveCollection).sync()),
    ).then(() => true);
  }
}
