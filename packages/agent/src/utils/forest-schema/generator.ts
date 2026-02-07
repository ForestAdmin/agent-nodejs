import type { AgentOptionsWithDefaults } from '../../types';
import type { DataSource } from '@forestadmin/datasource-toolkit';
import type { ForestSchema } from '@forestadmin/forestadmin-client';

import SchemaGeneratorCollection from './generator-collection';

export default class SchemaGenerator {
  private readonly schemaGeneratorCollection: SchemaGeneratorCollection;

  constructor(options: AgentOptionsWithDefaults) {
    this.schemaGeneratorCollection = new SchemaGeneratorCollection(options);
  }

  async buildSchema(dataSource: DataSource): Promise<Pick<ForestSchema, 'collections'>> {
    return {
      collections: await Promise.all(
        [...dataSource.collections]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(c => this.schemaGeneratorCollection.buildSchema(c)),
      ),
    };
  }

  static buildMetadata(
    features: Record<string, string> | null,
    aiProviders: Array<{ name: string; provider: string }> = [],
  ): Pick<ForestSchema, 'meta'> {
    const { version } = require('../../../package.json'); // eslint-disable-line @typescript-eslint/no-var-requires,global-require

    return {
      meta: {
        liana: 'forest-nodejs-agent',
        liana_version: version,
        liana_features: features,
        ai_llms:
          aiProviders.length > 0
            ? aiProviders.map(c => ({ name: c.name, provider: c.provider }))
            : null,
        stack: {
          engine: 'nodejs',
          engine_version: process.versions && process.versions.node,
        },
      },
    };
  }
}
