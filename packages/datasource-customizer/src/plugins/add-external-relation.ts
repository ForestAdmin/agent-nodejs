import type CollectionCustomizer from '../collection-customizer';
import type DataSourceCustomizer from '../datasource-customizer';
import type { TCollectionName, TFieldName, TSchema } from '../templates';
import type { OneToManyEmbeddedDefinition } from '../types';

import { SchemaUtils } from '@forestadmin/datasource-toolkit';

export default async function addExternalRelation<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
>(
  dataSourceCustomizer: DataSourceCustomizer<S>,
  collectionCustomizer: CollectionCustomizer<S, N>,
  options: { name: string } & OneToManyEmbeddedDefinition<S, N>,
): Promise<void> {
  const primaryKeys = SchemaUtils.getPrimaryKeys(collectionCustomizer.schema) as TFieldName<S, N>[];

  collectionCustomizer.addField(options.name, {
    dependencies: options.dependencies ?? primaryKeys,
    columnType: [options.schema],
    getValues: (records, context) => records.map(record => options.listRecords(record, context)),
  });
}
