import { DataSource } from '@forestadmin/datasource-toolkit';
import crypto from 'crypto';
import { readFileSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import JSONAPISerializer from 'json-api-serializer';
import stringify from 'json-stringify-pretty-compact';
import { resolve } from 'path';
import { ForestAdminHttpDriverOptions } from '../../types';
import SchemaGeneratorCollection from './generator-collection';
import { ForestServerCollection } from './types';

type RawSchema = ForestServerCollection[];
type SerializedSchema = { meta: { schemaFileHash: string } };
type Options = Pick<ForestAdminHttpDriverOptions, 'isProduction' | 'prefix' | 'schemaPath'>;

// Load version from package.json at startup
const { version } = JSON.parse(readFileSync(resolve(__dirname, '../../../package.json'), 'utf8'));

/**
 * Generate and dispatch dataSource schema on agent start.
 */
export default class SchemaEmitter {
  private static readonly meta = {
    liana: 'forest-nodejs-agent',
    liana_version: version,
    stack: {
      engine: 'nodejs',
      engine_version: process.versions && process.versions.node,
    },
  };

  static async getSerializedSchema(
    options: Options,
    dataSources: DataSource[],
  ): Promise<SerializedSchema> {
    const schema: RawSchema = options.isProduction
      ? await SchemaEmitter.loadFromDisk(options.schemaPath)
      : await SchemaEmitter.generate(options.prefix, dataSources);

    if (!options.isProduction) {
      const pretty = stringify(schema, { maxLength: 80 });
      await writeFile(options.schemaPath, pretty, { encoding: 'utf-8' });
    }

    const hash = crypto.createHash('sha1').update(JSON.stringify(schema)).digest('hex');

    return SchemaEmitter.serialize(schema, hash);
  }

  private static async loadFromDisk(schemaPath: string): Promise<RawSchema> {
    try {
      const fileContent = await readFile(schemaPath, { encoding: 'utf-8' });

      return JSON.parse(fileContent);
    } catch (e) {
      throw new Error(
        `Cannot load ${schemaPath}. Providing a schema is mandatory in production mode.`,
      );
    }
  }

  private static async generate(prefix: string, dataSources: DataSource[]): Promise<RawSchema> {
    const allCollectionSchemas = [];

    dataSources.forEach(dataSource => {
      const dataSourceCollectionSchemas = dataSource.collections.map(collection =>
        SchemaGeneratorCollection.buildSchema(prefix, collection),
      );
      allCollectionSchemas.push(...dataSourceCollectionSchemas);
    });

    return Promise.all(allCollectionSchemas);
  }

  private static serialize(schema: RawSchema, hash: string): SerializedSchema {
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
    ) as SerializedSchema;
  }
}
