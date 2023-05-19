import type { Configuration } from '../types';
import type { CollectionCustomizer } from '@forestadmin/datasource-customizer';

import { encodeDataUri } from '../utils/data-uri';

export default function createField(collection: CollectionCustomizer, config: Configuration): void {
  collection.addField(config.filename, {
    columnType: 'String', // TODO check type for config.readMode === 'download'
    dependencies: [config.sourcename],
    getValues: records =>
      records.map(async record => {
        const key = record[config.sourcename];

        if (!key) {
          return null;
        }

        if (config.readMode === 'title') {
          return (await config.client.load(key)).title;
        }

        if (config.readMode === 'download') {
          return encodeDataUri({
            mimeType: 'application/pdf',
            buffer: await config.client.exportToPdf(key),
          });
        }

        if (config.readMode === 'webViewLink') {
          return (await config.client.getFileFromDrive(key)).webViewLink;
        }

        if (config.readMode === 'webContentLink') {
          return (await config.client.getFileFromDrive(key)).webContentLink;
        }

        return key;
      }),
  });
}
