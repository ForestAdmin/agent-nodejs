import type {
  CollectionCustomizer,
  DataSourceCustomizer,
} from '@forestadmin/datasource-customizer';
import type { CollectionSchema, RelationSchema } from '@forestadmin/datasource-toolkit';

function getColumns(schema: CollectionSchema): string[] {
  return Object.keys(schema.fields).filter(name => schema.fields[name].type === 'Column');
}

function getRelation(
  relationName: string,
  dataSource: DataSourceCustomizer,
  collection: CollectionCustomizer,
): RelationSchema {
  const parts = relationName.split(':');
  const relation = collection.schema.fields[parts[0]];

  if (relation?.type !== 'ManyToOne' && relation?.type !== 'OneToOne') {
    const name = `'${collection.name}.${relationName}'`;

    let message: string;
    if (!relation) message = `Relation ${name} not found`;
    else if (relation.type === 'Column') message = `${name} is a column, not a relation`;
    else message = `${name} is not a ManyToOne or OneToOne relation`;

    throw new Error(message);
  }

  return parts.length > 1
    ? getRelation(
        parts.slice(1).join(':'),
        dataSource,
        dataSource.getCollection(relation.foreignCollection),
      )
    : relation;
}

/**
 * Import all fields of a relation in the current collection.
 *
 * @param dataSource - The dataSource customizer provided by the agent.
 * @param collection - The collection customizer instance provided by the agent.
 * @param options - The options of the plugin.
 * @param options.relationName - The name of the relation to import.
 * @param options.include - The list of fields to import.
 * @param options.exclude - The list of fields to exclude.
 * @param options.readonly - Should the imported fields be read-only?
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
  if (exclude?.length > 0) exclude.forEach(column => columns.delete(column));

  for (const column of columns) {
    const path = `${relationName}:${column}`;
    const alias = path.replace(/:/g, '@@@');

    collection.importField(alias, { path, readonly });
  }

  return this;
}
