import { DataSource } from '@forestadmin/datasource-toolkit';
import JSONAPISerializer from 'json-api-serializer';
import crypto from 'crypto';

import { ForestServerCollection } from './types';
import SchemaGeneratorCollection from './generator-collection';

type RawSchema = ForestServerCollection[];
type SerializedSchema = { meta: { schemaFileHash: string } };

export default class RawSchemaGenerator {
  private static readonly meta = {
    liana: 'forest-nodejs-agent',
    stack: {
      engine: 'nodejs',
      engine_version: process.versions && process.versions.node,
    },
  };

  public static async generate(dataSource: DataSource): Promise<RawSchema> {
    const allCollectionSchemas = [];

    const dataSourceCollectionSchemas = dataSource.collections.map(collection =>
      SchemaGeneratorCollection.buildSchema(collection),
    );
    allCollectionSchemas.push(...dataSourceCollectionSchemas);

    return Promise.all(allCollectionSchemas);
  }

  public static serialize(schema: RawSchema, lianaVersion: string): SerializedSchema {
    const hash = crypto.createHash('sha1').update(JSON.stringify(schema)).digest('hex');

    // Build serializer
    const serializer = new JSONAPISerializer();

    serializer.register('collections', {
      // Pass the metadata provided to the serialization fn
      topLevelMeta: (extraData: unknown) => extraData,
      relationships: {
        segments: { type: 'segments' },
        actions: { type: 'actions' },
      },
    });
    serializer.register('segments', {});
    serializer.register('actions', {});

    // Serialize
    return serializer.serialize(
      'collections',
      schema.map(c => ({ id: c.name, ...c })),
      { ...RawSchemaGenerator.meta, liana_version: lianaVersion, schemaFileHash: hash },
    ) as SerializedSchema;
  }
}
