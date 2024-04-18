import { DataSource } from '@forestadmin/datasource-toolkit';
import {
  ForestSchemaActionFieldV2,
  ForestSchemaActionV2,
  ForestSchemaCollectionV2,
  ForestSchemaFieldV2,
  ForestSchemaV2,
  SCHEMA_V2_ACTION_FIELD_MASK,
  SCHEMA_V2_ACTION_MASK,
  SCHEMA_V2_COLLECTION_MASK,
  SCHEMA_V2_FIELDS_MASK,
} from '@forestadmin/forestadmin-client';

import SchemaGeneratorCollectionV2 from './generator-collection-v2';

export default class SchemaGeneratorV2 {
  static async buildSchema(dataSource: DataSource): Promise<Pick<ForestSchemaV2, 'collections'>> {
    return {
      collections: await Promise.all(
        [...dataSource.collections]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(c => SchemaGeneratorCollectionV2.buildSchema(c)),
      ),
    };
  }

  static buildMetadata(features: Record<string, string> | null): Pick<ForestSchemaV2, 'meta'> {
    const { version } = require('../../../package.json'); // eslint-disable-line @typescript-eslint/no-var-requires,global-require,max-len

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

  static minimizeSchema(
    schema: Pick<ForestSchemaV2, 'collections'>,
  ): Pick<ForestSchemaV2, 'collections'> {
    const reducedSchema: Pick<ForestSchemaV2, 'collections'> = { ...schema };
    reducedSchema.collections = schema.collections.map(SchemaGeneratorV2.templateReduceCollection);

    return reducedSchema;
  }

  private static templateReduceAction(action: ForestSchemaActionV2): ForestSchemaActionV2 {
    const fields = action?.fields || [];
    const reduced: ForestSchemaActionV2 = { ...action };
    reduced.fields = fields.map(field =>
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      SchemaGeneratorV2.reduceFromTemplate(field, SCHEMA_V2_ACTION_FIELD_MASK),
    ) as ForestSchemaActionFieldV2[];

    return SchemaGeneratorV2.reduceFromTemplate(
      reduced,
      SCHEMA_V2_ACTION_MASK,
    ) as ForestSchemaActionV2;
  }

  private static templateReduceCollection(
    collection: ForestSchemaCollectionV2,
  ): ForestSchemaCollectionV2 {
    const fields = collection?.fields || [];
    const actions = collection?.actions || [];

    const reduced: ForestSchemaCollectionV2 = { ...collection };

    reduced.fields = fields.map(field =>
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      SchemaGeneratorV2.reduceFromTemplate(field, SCHEMA_V2_FIELDS_MASK),
    ) as ForestSchemaFieldV2[];
    reduced.actions = actions.map(action => SchemaGeneratorV2.templateReduceAction(action));

    return SchemaGeneratorV2.reduceFromTemplate(
      reduced,
      SCHEMA_V2_COLLECTION_MASK,
    ) as ForestSchemaCollectionV2;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static reduceFromTemplate(input: any, mask: any): any {
    const reduced = { ...input };
    Object.keys(mask).forEach(key => {
      if (
        Object.keys(input).includes(key) &&
        JSON.stringify(input[key]) === JSON.stringify(mask[key])
      ) {
        delete reduced[key];
      }
    });

    return reduced;
  }
}
