import type {
  CollectionCustomizer,
  DataSourceCustomizer,
} from '@forestadmin/datasource-customizer';

import { getColumns, getRelation } from './helpers';

/**
 * Import all fields of a relation in the current collection.
 *
 * @param dataSource The dataSource customizer provided by the agent.
 * @param collection The collection customizer instance provided by the agent.
 * @param options The options of the plugin.
 * @param options.relationName The name of the relation to import.
 * @param options.include The list of fields to import.
 * @param options.exclude The list of fields to exclude.
 * @param options.readonly Should the imported fields be read-only?
 */
export default async function flattenRelation(
  dataSource: DataSourceCustomizer,
  collection: CollectionCustomizer,
  options?: {
    relationName: string;
    include?: string[];
    exclude?: string[];
    readonly?: boolean;
  },
): Promise<void> {
  if (!options || !options.relationName) throw new Error('options.relationName is required.');
  if (!collection) throw new Error('This plugin can only be called when customizing collections.');

  const { relationName, include, exclude, readonly } = options;
  const relation = getRelation(relationName, dataSource, collection);
  const foreignCollection = dataSource.getCollection(relation.foreignCollection);

  const columns = new Set(include?.length > 0 ? include : getColumns(foreignCollection.schema));
  exclude?.forEach(column => columns.delete(column));

  for (const column of columns) {
    const path = `${relationName}:${column}`;
    const alias = path.replace(/:/g, '@@@');

    collection.importField(alias, { path, readonly });
  }

  return this;
}
