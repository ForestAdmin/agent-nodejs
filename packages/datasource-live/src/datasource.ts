import { Logger } from '@forestadmin/datasource-toolkit';
import { Sequelize } from 'sequelize';
import { SequelizeDataSource } from '@forestadmin/datasource-sequelize';

import { LiveSchema } from './types';
import CollectionAttributesConverter from './utils/collection-schema-to-model-attributes-converter';
import CollectionRelationsConverter from './utils/collection-schema-to-model-relations-converter';
import LiveCollection from './collection';

export default class LiveDataSource extends SequelizeDataSource {
  constructor(dataSourceSchema: LiveSchema, logger?: Logger) {
    const logging = (sql: string) => logger?.('Debug', sql.substring(sql.indexOf(':') + 2));
    super(new Sequelize('sqlite::memory:', { logging }));

    const collections = Object.entries(dataSourceSchema);

    // Convert all collections to Sequelize models, only with plain attributes.
    collections.forEach(([name, schema]) => {
      this.sequelize.define(name, CollectionAttributesConverter.convert(schema));
    });

    // Add all relationships.
    collections.forEach(([name, schema]) => {
      CollectionRelationsConverter.convert(name, schema, this.sequelize);
    });

    // Add actual Collection instances to DataSource.
    collections.forEach(([name]) => {
      this.addCollection(new LiveCollection(name, this, this.sequelize.model(name)));
    });
  }

  async syncCollections(): Promise<boolean> {
    await Promise.all(this.collections.map(collection => (collection as LiveCollection).sync()));

    return true;
  }
}
