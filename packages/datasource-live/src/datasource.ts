import { Sequelize } from 'sequelize';

import { DataSourceSchema } from '@forestadmin/datasource-toolkit';
import { SequelizeDataSource } from '@forestadmin/datasource-sequelize';

import LiveCollection from './collection';

import CollectionSchemaConverter from './utils/collection-schema-to-model-attributes-converter';

export default class LiveDataSource extends SequelizeDataSource {
  constructor(dataSourceSchema: DataSourceSchema) {
    super([], new Sequelize('sqlite::memory:', { logging: false }));
    const collections = Object.entries(dataSourceSchema.collections);

    // Convert all collections to Sequelize models.
    collections.forEach(([name, schema]) => {
      const modelSchema = CollectionSchemaConverter.convert(schema);
      const model = this.sequelize.define(name, modelSchema);

      return model;
    });

    // Extend models with relationships.
    collections.forEach(([name, schema]) => {
      void name;
      void schema;
    });

    // Add actual Collection instances to DataSource.
    collections.forEach(([name, schema]) => {
      this.addCollection(new LiveCollection(name, this, this.sequelize, schema));
    });
  }

  async syncCollections(): Promise<boolean> {
    return Promise.all(
      this.collections.map(collection => (collection as LiveCollection).sync()),
    ).then(() => true);
  }
}
