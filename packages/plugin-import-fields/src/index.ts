/* eslint-disable import/prefer-default-export */
import type {
  CollectionCustomizer,
  DataSourceCustomizer,
} from '@forestadmin/datasource-customizer';
import type { CollectionSchema, RelationSchema } from '@forestadmin/datasource-toolkit';

function getColumns(schema: CollectionSchema): string[] {
  return Object.keys(schema.fields).filter(fieldName => schema.fields[fieldName].type === 'Column');
}

function getRelationOrThrowError(
  relationName: string,
  collectionCustomizer: CollectionCustomizer,
): RelationSchema {
  const relation = collectionCustomizer.schema.fields[relationName] as RelationSchema;

  if (relation === undefined) {
    throw new Error(
      `Relation ${relationName} not found in collection ${collectionCustomizer.name}`,
    );
  }

  if (relation.type === 'ManyToMany') {
    throw new Error(
      `Relation ${relationName} is a ManyToMany relation. This plugin does not support it.`,
    );
  }

  if (relation.type === 'OneToMany') {
    throw new Error(
      `Relation ${relationName} is a ManyToOne relation. This plugin does not support it.`,
    );
  }

  return relation;
}

/**
 * Import all the fields of a relation in the current collection.
 * @param dataSourceCustomizer - The da dataSource customizer provided by the agent.
 * @param collectionCustomizer - The collection customizer instance provided by the agent.
 * @param options - The options of the plugin.
 * @param options.relationName - The name of the relation to import.
 * @param options.include - The list of fields to import.
 * @param options.exclude - The list of fields to exclude.
 */
export async function importFields(
  dataSourceCustomizer: DataSourceCustomizer,
  collectionCustomizer: CollectionCustomizer,
  options?: {
    relationName: string;
    include?: string[];
    exclude?: string[];
  },
): Promise<void> {
  const { relationName, include, exclude } = options;

  const relation = getRelationOrThrowError(relationName, collectionCustomizer);
  const foreignCollection = dataSourceCustomizer.getCollection(relation.foreignCollection);
  const columns =
    include?.length > 0 ? new Set(include) : new Set(getColumns(foreignCollection.schema));

  if (exclude?.length > 0) {
    exclude.forEach(column => columns.delete(column));
  }

  columns.forEach(column => {
    const path = `${relationName}:${column}`;
    const supportedFormatByFrontend = `${relationName}_${column}`;
    collectionCustomizer.importField(supportedFormatByFrontend, { path });
  });

  return this;
}
