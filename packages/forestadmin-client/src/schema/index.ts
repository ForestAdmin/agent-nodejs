import type { ForestAdminServerInterface, ForestSchemaCollection } from '../types';
import type { ForestSchema } from './types';

import crypto from 'crypto';
import JSONAPISerializer from 'json-api-serializer';

import { toHttpOptions } from '../utils/http-options';

type SerializedSchema = { meta: { schemaFileHash: string } };

export interface SchemaServiceOptions {
  envSecret: string;
  forestServerUrl: string;
  /** Optional logger function for schema operations */
  logger?: (level: 'Info' | 'Warn' | 'Error' | 'Debug', message: string) => void;
}

export default class SchemaService {
  constructor(
    private forestAdminServerInterface: ForestAdminServerInterface,
    private options: SchemaServiceOptions,
  ) {}

  async postSchema(schema: ForestSchema): Promise<boolean> {
    const apimap = SchemaService.serialize(schema);
    const httpOptions = toHttpOptions(this.options);
    const shouldSend = await this.doServerWantsSchema(apimap.meta.schemaFileHash);

    if (shouldSend) {
      await this.forestAdminServerInterface.postSchema(httpOptions, apimap);
    }

    const message = shouldSend
      ? 'Schema was updated, sending new version'
      : 'Schema was not updated since last run';

    if (this.options.logger) {
      this.options.logger('Info', `${message} (hash: ${apimap.meta.schemaFileHash})`);
    }

    return shouldSend;
  }

  async getSchema(): Promise<ForestSchemaCollection[]> {
    return this.forestAdminServerInterface.getSchema(toHttpOptions(this.options));
  }

  static serialize(schema: ForestSchema): SerializedSchema {
    const data = schema.collections.map(c => ({ id: c.name, ...c }));
    const schemaFileHash = crypto.createHash('sha1').update(JSON.stringify(schema)).digest('hex');

    return SchemaService.serializer.serialize('collections', data, {
      ...schema.meta,
      schemaFileHash,
    }) as SerializedSchema;
  }

  private static get serializer(): JSONAPISerializer {
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

    return serializer;
  }

  private async doServerWantsSchema(hash: string): Promise<boolean> {
    // Check if the schema was already sent by another agent
    const { sendSchema } = await this.forestAdminServerInterface.checkSchemaHash(
      toHttpOptions(this.options),
      hash,
    );

    return sendSchema;
  }
}
