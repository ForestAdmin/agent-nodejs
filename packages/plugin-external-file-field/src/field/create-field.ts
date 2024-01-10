import type { Configuration } from '../types';
import type { CollectionCustomizer } from '@forestadmin/datasource-customizer';
import type { ColumnSchema } from '@forestadmin/datasource-toolkit';

export default function createField(collection: CollectionCustomizer, config: Configuration): void {
  const dependencies = config.objectKeyFromRecord?.extraDependencies ?? [];
  const { columnType } = collection.schema.fields[config.sourcename] as ColumnSchema;

  if (!dependencies.includes(config.sourcename)) {
    dependencies.push(config.sourcename);
  }

  collection.addField(config.filename, {
    columnType,
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

        const isArray = columnType !== 'String';
        const keys = isArray ? key : [key];
        const signedUrls = Promise.all(keys.map(file => config.client.getUrlFromKey(file)));

        return signedUrls;
      }),
  });
}
