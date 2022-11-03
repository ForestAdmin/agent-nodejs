import crypto from 'crypto';
import JSONAPISerializer from 'json-api-serializer';

import { ForestServerCollection } from './types';

type SerializedSchema = { meta: { schemaFileHash: string } };

export default class SchemaSerializer {
  private static readonly meta = {
    liana: 'forest-nodejs-agent',
    stack: {
      engine: 'nodejs',
      engine_version: process.versions && process.versions.node,
    },
  };

  static serialize(schema: ForestServerCollection[], lianaVersion: string): SerializedSchema {
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
      { ...SchemaSerializer.meta, liana_version: lianaVersion, schemaFileHash: hash },
    ) as SerializedSchema;
  }
}
