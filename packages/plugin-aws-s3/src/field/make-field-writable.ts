import type { CollectionCustomizer } from '@forestadmin/datasource-customizer';
import type { ColumnSchema, RecordData } from '@forestadmin/datasource-toolkit';

import { Configuration } from '../types';
import { parseDataUri } from '../utils/data-uri';

function getRecordId(collection: CollectionCustomizer, record: RecordData): string[] {
  return Object.entries(collection.schema.fields)
    .filter(([, schema]) => schema.type === 'Column' && schema.isPrimaryKey)
    .map(([name]) => record[name]);
}

export default function makeFieldWritable(
  collection: CollectionCustomizer,
  config: Configuration,
): void {
  const schema = collection.schema.fields[config.sourcename] as ColumnSchema;
  if (schema.isReadOnly) return;

  collection.replaceFieldWriting(config.filename, async (value, context) => {
    const patch = { [config.sourcename]: null };

    if (value) {
      const recordId = getRecordId(collection, context.record).join('|');
      const file = parseDataUri(value);
      const key = config.storeAt(recordId, file.name);

      await config.client.save(key, file, config.acl);
      patch[config.sourcename] = key;
    }

    return patch;
  });
}
