import { DataSource } from '@forestadmin/datasource-toolkit';
import { ForestSchema } from '@forestadmin/forestadmin-client';

import SchemaGeneratorCollection from './generator-collection';

export default class SchemaGenerator {
  static async buildSchema(dataSource: DataSource): Promise<ForestSchema> {
    const { version } = require('../../../package.json'); // eslint-disable-line @typescript-eslint/no-var-requires,global-require,max-len

    return {
      collections: await Promise.all(
        dataSource.collections.map(c => SchemaGeneratorCollection.buildSchema(c)),
      ),
      metadata: {
        liana: 'forest-nodejs-agent',
        liana_version: version,
        stack: {
          engine: 'nodejs',
          engine_version: process.versions && process.versions.node,
        },
      },
    };
  }
}
