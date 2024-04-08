import { DataSource } from '@forestadmin/datasource-toolkit';
import { ForestSchema } from '@forestadmin/forestadmin-client';

import SchemaGeneratorCollection from './generator-collection';

export default class SchemaGenerator {
  static async buildSchema(dataSource: DataSource): Promise<Pick<ForestSchema, 'collections'>> {
    return {
      collections: await Promise.all(
        [...dataSource.collections]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(c => SchemaGeneratorCollection.buildSchema(c)),
      ),
    };
  }

  static buildMetadata(features: Record<string, string> | null): Pick<ForestSchema, 'meta'> {
    const { version } = require('../../../package.json'); // eslint-disable-line @typescript-eslint/no-var-requires,global-require

    return {
      meta: {
        liana: 'forest-nodejs-agent',
        liana_version: version,
        liana_features: features,
        stack: {
          engine: 'nodejs',
          engine_version: process.versions && process.versions.node,
        },
      },
    };
  }
}
