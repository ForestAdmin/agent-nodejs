import { RelationSchema, SchemaUtils } from '@forestadmin/datasource-toolkit';

import { TCollectionName, TFieldName, TFieldRelation, TSchema } from '../templates';
import CollectionCustomizer from '../collection-customizer';
import DataSourceCustomizer from '../datasource-customizer';

export default async function importFieldsFromRelation<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
>(
  dataSourceCustomizer: DataSourceCustomizer<S>,
  collectionCustomizer: CollectionCustomizer<S, N>,
  options: {
    relationName: string;
    options?: { include?: TFieldRelation<S, N>[]; exclude?: TFieldRelation<S, N>[] };
  },
): Promise<void> {
  const { relationName, options: { include, exclude } = {} } = options;

  const relation = collectionCustomizer.schema.fields[relationName] as RelationSchema;
  const foreignCollection = dataSourceCustomizer.getCollection(relation.foreignCollection);

  const columns = include?.length
    ? new Set(include)
    : new Set(SchemaUtils.getColumns(foreignCollection.schema).map(c => `${relationName}:${c}`));
  exclude?.forEach(column => columns.delete(column));

  columns.forEach(path => {
    this.importField(path.replace(':', '_'), { path: path as TFieldName<S, N> });
  });

  return this;
}
