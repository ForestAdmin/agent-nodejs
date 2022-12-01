import type {
  CollectionCustomizer,
  DataSourceCustomizer,
} from '@forestadmin/datasource-customizer';
import type { CollectionSchema, RelationSchema } from '@forestadmin/datasource-toolkit';

function getColumns(schema: CollectionSchema): string[] {
  return Object.keys(schema.fields).filter(fieldName => schema.fields[fieldName].type === 'Column');
}

function getRelation(
  relationName: string,
  dataSourceCustomizer: DataSourceCustomizer,
  collectionCustomizer: CollectionCustomizer,
): RelationSchema {
  const parts = relationName.split(':');
  const relation = collectionCustomizer.schema.fields[parts[0]];

  if (relation?.type !== 'ManyToOne' && relation?.type !== 'OneToOne') {
    const name = `'${collectionCustomizer.name}.${relationName}'`;

    let message: string;
    if (!relation) message = `Relation ${name} not found`;
    else if (relation.type === 'Column') message = `${relationName} is a column, not a relation`;
    else message = `Relation ${name} is not a ManyToOne or OneToOne relation`;
    throw new Error(message);
  }

  return parts.length > 1
    ? getRelation(
        parts.slice(1).join(':'),
        dataSourceCustomizer,
        dataSourceCustomizer.getCollection(relation.foreignCollection),
      )
    : relation;
}

/**
 * Import all fields of a relation in the current collection.
 *
 * @param dataSourceCustomizer - The dataSource customizer provided by the agent.
 * @param collectionCustomizer - The collection customizer instance provided by the agent.
 * @param options - The options of the plugin.
 * @param options.relationName - The name of the relation to import.
 * @param options.include - The list of fields to import.
 * @param options.exclude - The list of fields to exclude.
 * @param options.readonly - Should the imported fields be read-only?
 */
export default async function flattenRelation(
  dataSourceCustomizer: DataSourceCustomizer,
  collectionCustomizer: CollectionCustomizer,
  options?: {
    relationName: string;
    include?: string[];
    exclude?: string[];
    readonly?: boolean;
  },
): Promise<void> {
  if (!options || !options.relationName) {
    throw new Error('Relation name is required');
  }

  if (!collectionCustomizer) {
    throw new Error(
      'This plugin should be called when you are customizing a collection' +
        ' not directly on the agent',
    );
  }

  const { relationName, include, exclude, readonly } = options;
  const relation = getRelation(relationName, dataSourceCustomizer, collectionCustomizer);
  const foreignCollection = dataSourceCustomizer.getCollection(relation.foreignCollection);
  const columns = new Set(include?.length > 0 ? include : getColumns(foreignCollection.schema));
  if (exclude?.length > 0) exclude.forEach(column => columns.delete(column));

  for (const column of columns) {
    const path = `${relationName}:${column}`;
    const alias = path.replace(/:/g, '@@@');

    collectionCustomizer.importField(alias, { path, readonly });
  }

  return this;
}
