import crypto from 'crypto';
import JSONAPISerializer from 'json-api-serializer';

import { ForestAdminClientOptionsWithDefaults } from '../types';
import ServerUtils from '../utils/server';
import { ForestServerCollection } from './types';

type SerializedSchema = { meta: { schemaFileHash: string } };

export default class SchemaService {
  private serializer: JSONAPISerializer = this.getSerializer();

  constructor(private options: ForestAdminClientOptionsWithDefaults) {}

  async postSchema(
    schema: ForestServerCollection[],
    agentName: string,
    agentVersion: string,
  ): Promise<boolean> {
    const apimap = this.serialize(schema, agentName, agentVersion);
    const shouldSend = await this.doServerWantsSchema(apimap.meta.schemaFileHash);

    if (shouldSend) {
      await ServerUtils.query(this.options, 'post', '/forest/apimaps', {}, apimap);
    }

    return shouldSend;
  }

  private serialize(
    schema: ForestServerCollection[],
    agentName: string,
    agentVersion: string,
  ): SerializedSchema {
    const data = schema.map(c => ({ id: c.name, ...c }));
    const meta = {
      liana: agentName,
      liana_version: agentVersion,
      stack: {
        engine: 'nodejs',
        engine_version: process.versions && process.versions.node,
      },
    };

    const schemaFileHash = crypto
      .createHash('sha1')
      .update(JSON.stringify({ ...schema, meta }))
      .digest('hex');

    return this.serializer.serialize('collections', data, {
      ...meta,
      schemaFileHash,
    }) as SerializedSchema;
  }

  private getSerializer(): JSONAPISerializer {
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
