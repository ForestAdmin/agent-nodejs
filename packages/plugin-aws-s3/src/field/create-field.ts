import type { Configuration } from '../types';
import type { CollectionCustomizer } from '@forestadmin/datasource-customizer';

import { encodeDataUri } from '../utils/data-uri';

export default function createField(collection: CollectionCustomizer, config: Configuration): void {
  const dependencies = config.objectKeyFromRecord?.extraDependencies ?? [];

  if (!dependencies.includes(config.sourcename)) {
    dependencies.push(config.sourcename);
  }

  collection.addField(config.filename, {
    columnType: 'String',
    dependencies,
    getValues: (records, context) =>
      records.map(async record => {
        let key = record[config.sourcename];

        if (!key) {
          return null;
        }

        key = config.objectKeyFromRecord?.mappingFunction
          ? await config.objectKeyFromRecord.mappingFunction(record, context)
          : key;

        if (config.readMode === 'proxy') {
          return encodeDataUri(await config.client.load(key));
        }

        if (config.acl === 'public-read' || config.acl === 'public-read-write') {
          return config.client.getPublicUrl(key);
        }

        return config.client.getSignedUrl(key);
      }),
  });
}
