import crypto from 'crypto';
import JSONAPISerializer from 'json-api-serializer';

import { ForestSchema } from './types';
import { ForestAdminClientOptionsWithDefaults } from '../types';
import ServerUtils from '../utils/server';

type SerializedSchema = { meta: { schemaFileHash: string } };

export default class SchemaService {
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

  constructor(private options: ForestAdminClientOptionsWithDefaults) {}

  async postSchema(schema: ForestSchema): Promise<boolean> {
    const apimap = SchemaService.serialize(schema);
    const shouldSend = await this.doServerWantsSchema(apimap.meta.schemaFileHash);

    if (shouldSend) {
      await ServerUtils.query(this.options, 'post', '/forest/apimaps', {}, apimap);
    }

    const message = shouldSend
      ? 'Schema was updated, sending new version'
      : 'Schema was not updated since last run';

    this.options.logger('Info', `${message} (hash: ${apimap.meta.schemaFileHash})`);

    return shouldSend;
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
