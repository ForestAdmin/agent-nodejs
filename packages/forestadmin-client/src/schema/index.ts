import type { ForestSchema } from './types';
import type { ForestAdminClientOptionsWithDefaults, ForestSchemaCollection } from '../types';

import crypto from 'crypto';
import JSONAPISerializer from 'json-api-serializer';

import ServerUtils from '../utils/server';

type SerializedSchema = { meta: { schemaFileHash: string } };

export interface SchemaServiceOptions {
  envSecret: string;
  forestServerUrl: string;
}

export default class SchemaService {
  constructor(private options: SchemaServiceOptions) {}

  async postSchema(schema: ForestSchema): Promise<boolean> {
    const apimap = SchemaService.serialize(schema);
    const shouldSend = await this.doServerWantsSchema(apimap.meta.schemaFileHash);

    if (shouldSend) {
      await ServerUtils.query(this.options, 'post', '/forest/apimaps', {}, apimap);
    }

    const message = shouldSend
      ? 'Schema was updated, sending new version'
      : 'Schema was not updated since last run';

    const optionsWithLogger = this.options as ForestAdminClientOptionsWithDefaults;

    if (optionsWithLogger.logger) {
      optionsWithLogger.logger('Info', `${message} (hash: ${apimap.meta.schemaFileHash})`);
    }

    return shouldSend;
  }

  async getSchema(): Promise<ForestSchemaCollection[]> {
    const response = await ServerUtils.query<{
      data: Array<{ id: string; type: string; attributes: Record<string, unknown> }>;
      included?: Array<{ id: string; type: string; attributes: Record<string, unknown> }>;
    }>(this.options, 'get', '/liana/forest-schema');

    const serializer = new JSONAPISerializer();
    serializer.register('collections', {
      relationships: {
        fields: { type: 'fields' },
        actions: { type: 'actions' },
        segments: { type: 'segments' },
      },
    });
    serializer.register('fields', {});
    serializer.register('actions', {});
    serializer.register('segments', {});

    return serializer.deserialize('collections', response) as ForestSchemaCollection[];
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
    const { sendSchema } = await ServerUtils.query<{ sendSchema: boolean }>(
      this.options,
      'post',
      '/forest/apimaps/hashcheck',
      {},
      { schemaFileHash: hash },
    );

    return sendSchema;
  }
}
