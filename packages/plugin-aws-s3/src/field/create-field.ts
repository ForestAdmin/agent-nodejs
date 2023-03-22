import type { Configuration } from '../types';
import type { CollectionCustomizer } from '@forestadmin/datasource-customizer';

import { encodeDataUri } from '../utils/data-uri';

export default function createField(collection: CollectionCustomizer, config: Configuration): void {
  collection.addField(config.filename, {
    columnType: 'String',
    dependencies: [config.sourcename],
    getValues: records =>
      records.map(async record => {
        const key = record[config.sourcename];

        if (!key) {
          return null;
        }

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
