import { Sequelize } from 'sequelize';
import { DataSourceSchema } from '@forestadmin/datasource-toolkit';
import { SequelizeDataSource } from '@forestadmin/datasource-sequelize';

import LiveCollection from './collection';
import CollectionAttributesConverter from './utils/collection-schema-to-model-attributes-converter';
import CollectionRelationsConverter from './utils/collection-schema-to-model-relations-converter';

export default class LiveDataSource extends SequelizeDataSource {
  constructor(dataSourceSchema: DataSourceSchema) {
    super([], new Sequelize('sqlite::memory:', { logging: false }));
    const collections = Object.entries(dataSourceSchema.collections);

    // Convert all collections to Sequelize models, only with plain attributes.
    collections.forEach(([name, schema]) => {
      this.sequelize.define(name, CollectionAttributesConverter.convert(schema));
    });

    // Add all relationships.
    collections.forEach(([name, schema]) => {
      CollectionRelationsConverter.convert(name, schema, this.sequelize);
    });

    // Add actual Collection instances to DataSource.
    collections.forEach(([name, schema]) => {
      this.addCollection(new LiveCollection(name, this, this.sequelize, schema));
    });
  }

  async syncCollections(): Promise<boolean> {
    await Promise.all(
      this.collections.map(collection => (collection as LiveCollection).sync()),
    );

    return true;
  }
}
