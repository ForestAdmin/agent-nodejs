import { DataSource } from '@forestadmin/datasource-toolkit';
import crypto from 'crypto';
import fs from 'fs/promises';
import JSONAPISerializer from 'json-api-serializer';
import stringify from 'json-stringify-pretty-compact';
import path from 'path';
import { ForestAdminHttpDriverOptions } from '../../types';
import SchemaGeneratorCollection from './generator-collection';
import { ForestServerCollection } from './types';

type JsonApiDocument = JSONAPISerializer.JSONAPIDocument;
type Schema = ForestServerCollection[];
type Options = Pick<
  ForestAdminHttpDriverOptions,
  'envSecret' | 'forestServerUrl' | 'isProduction' | 'logger' | 'prefix' | 'schemaDir'
>;

/**
 * Generate and dispatch dataSource schema on agent start.
 */
export default class SchemaEmitter {
  private static readonly meta = {
    liana: 'forest-nodejs-agent',
    liana_version: '1.0.0',
    stack: {
      engine: 'nodejs',
      engine_version: process.versions && process.versions.node,
    },
  };

  static async getSchema(
    options: Options,
    dataSource: DataSource,
  ): Promise<[JsonApiDocument, string]> {
    const schema: Schema = options.isProduction
      ? await SchemaEmitter.loadFromDisk(options.schemaDir)
      : await SchemaEmitter.generate(options.prefix, dataSource);

    if (!options.isProduction) {
      const schemaPath = path.join(options.schemaDir, '.forestadmin-schema.json');
      const pretty = stringify(schema, { maxLength: 80 });
      await fs.writeFile(schemaPath, pretty, { encoding: 'utf-8' });
    }

    const hash = crypto.createHash('sha1').update(JSON.stringify(schema)).digest('hex');
    const apimap = SchemaEmitter.serialize(schema, hash);

    return [apimap, hash];
  }

  private static async loadFromDisk(schemaDir: string): Promise<Schema> {
    const schemaPath = path.join(schemaDir, '.forestadmin-schema.json');

    try {
      const fileContent = await fs.readFile(schemaPath, { encoding: 'utf-8' });

      return JSON.parse(fileContent);
    } catch (e) {
      throw new Error(`Failed to load ${schemaPath}`);
    }
  }

  private static async generate(prefix: string, dataSource: DataSource): Promise<Schema> {
    const collectionSchemas = dataSource.collections.map(collection =>
      SchemaGeneratorCollection.buildSchema(prefix, collection),
    );

    return Promise.all(collectionSchemas);
  }

  private static serialize(schema: Schema, hash: string): JsonApiDocument {
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
      { ...SchemaEmitter.meta, schemaFileHash: hash },
    );
  }
}
