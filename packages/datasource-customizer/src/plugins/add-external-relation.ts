import { SchemaUtils } from '@forestadmin/datasource-toolkit';

import CollectionCustomizer from '../collection-customizer';
import DataSourceCustomizer from '../datasource-customizer';
import { TCollectionName, TFieldName, TSchema } from '../templates';
import { OneToManyEmbeddedDefinition } from '../types';

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
    getValues: async (records, context) =>
      Promise.all(records.map(async record => options.listRecords(record, context))),
  });
}
