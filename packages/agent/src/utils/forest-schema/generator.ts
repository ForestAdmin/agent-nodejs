import { DataSource } from '@forestadmin/datasource-toolkit';
import { ForestServerCollection, SchemaMetadata } from '@forestadmin/forestadmin-client';

import SchemaGeneratorCollection from './generator-collection';

export default class SchemaGenerator {
  static async buildSchema(dataSource: DataSource): Promise<ForestServerCollection[]> {
    return Promise.all(dataSource.collections.map(c => SchemaGeneratorCollection.buildSchema(c)));
  }

  static buildSchemaMetadata(): SchemaMetadata {
    const { version } = require('../../../package.json'); // eslint-disable-line @typescript-eslint/no-var-requires,global-require,max-len

    return {
      liana: 'forest-nodejs-agent',
      liana_version: version,
      stack: {
        engine: 'nodejs',
        engine_version: process.versions && process.versions.node,
      },
    };
  }
}
