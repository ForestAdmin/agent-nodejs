import { DataSource } from '@forestadmin/datasource-toolkit';
import { readFile, writeFile } from 'fs/promises';
import stringify from 'json-stringify-pretty-compact';

import { AgentOptions } from '../../types';
import { ForestServerCollection } from './types';
import SchemaGenerator from './schema-generator';
import SchemaSerializer from './schema-serializer';

type RawSchema = ForestServerCollection[];
type SerializedSchema = { meta: { schemaFileHash: string } };
type Options = Pick<AgentOptions, 'isProduction' | 'schemaPath'>;

// Load version from package.json at startup
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version } = require('../../../package.json');

/**
 * Generate and dispatch dataSource schema on agent start.
 */
export default class SchemaEmitter {
  static async getSerializedSchema(
    options: Options,
    dataSource: DataSource,
  ): Promise<SerializedSchema> {
    const schema: RawSchema = options.isProduction
      ? await SchemaEmitter.loadFromDisk(options.schemaPath)
      : await SchemaGenerator.generate(dataSource);

    if (!options.isProduction) {
      const pretty = stringify(schema, { maxLength: 80 });
      await writeFile(options.schemaPath, pretty, { encoding: 'utf-8' });
    }

    return SchemaSerializer.serialize(schema, version);
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
}
