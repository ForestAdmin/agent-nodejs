import { DataSource } from '@forestadmin/datasource-toolkit';
import { ForestSchema } from '@forestadmin/forestadmin-client';

import SchemaGeneratorCollection from './generator-collection';
import ActionCustomizationService from '../../services/model-customizations/action-customization';

export default class SchemaGenerator {
  static async buildSchema(dataSource: DataSource, features: string[]): Promise<ForestSchema> {
    const { version } = require('../../../package.json'); // eslint-disable-line @typescript-eslint/no-var-requires,global-require,max-len

    return {
      collections: await Promise.all(
        [...dataSource.collections]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(c => SchemaGeneratorCollection.buildSchema(c)),
      ),
      metadata: {
        liana: 'forest-nodejs-agent',
        liana_version: version,
        liana_features: SchemaGenerator.buildFeatures(features),
        stack: {
          engine: 'nodejs',
          engine_version: process.versions && process.versions.node,
        },
      },
    };
  }

  private static buildFeatures(features: string[]): Record<string, string> {
    const result = Object.entries({
      [ActionCustomizationService.FEATURE]: ActionCustomizationService.VERSION,
    })
      .filter(([feature]) => features.includes(feature))
      .reduce(
        (acc, [feature, version]) => ({
          ...acc,
          [feature]: version,
        }),
        {},
      );

    return Object.keys(result).length ? result : null;
  }
}
