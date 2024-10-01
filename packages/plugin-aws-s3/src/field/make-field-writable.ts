import type { CollectionCustomizer } from '@forestadmin/datasource-customizer';

import { RecordData, SchemaUtils } from '@forestadmin/datasource-toolkit';

import { Configuration } from '../types';
import { parseDataUri } from '../utils/data-uri';

function getPks(collection: CollectionCustomizer): string[] {
  return Object.entries(collection.schema.fields)
    .filter(([, schema]) => schema.type === 'Column' && schema.isPrimaryKey)
    .map(([name]) => name);
}

function computeProjection(collection: CollectionCustomizer, config: Configuration): string[] {
  return [
    ...new Set([
      config.sourcename, // storage field
      ...getPks(collection), // pk
      ...(config.objectKeyFromRecord?.extraDependencies ?? []), // extra deps
    ]),
  ];
}

export default function makeFieldWritable(
  collection: CollectionCustomizer,
  config: Configuration,
): void {
  const schema = SchemaUtils.getColumn(collection.schema, config.sourcename, collection.name);
  if (schema.isReadOnly) return;

  collection.replaceFieldWriting(config.filename, async (value, context) => {
    const patch = { [config.sourcename]: null };

    if (value) {
      const file = parseDataUri(value);
      let record: RecordData = null;
      let recordId: string = null;

      if (context.action === 'update') {
        // On updates, we fetch the missing information from the database.
        const pks = getPks(collection);
        const projection = computeProjection(collection, config);
        const records = await context.collection.list(context.filter || {}, projection);

        // context.record is the patch coming from the frontend.
        record = { ...(records?.[0] ?? {}), ...context.record };
        recordId = pks.map(pk => record[pk]).join('|');
      } else {
        // context.record is the record coming from the frontend.
        record = { ...context.record };
      }

      patch[config.sourcename] = await config.storeAt(recordId, file.name, context);

      // Update database and s3 bucket
      await config.client.save(
        config.objectKeyFromRecord?.mappingFunction
          ? await config.objectKeyFromRecord.mappingFunction({ ...record, ...patch }, context)
          : patch[config.sourcename],
        file,
        config.acl,
      );
    }

    return patch;
  });
}
