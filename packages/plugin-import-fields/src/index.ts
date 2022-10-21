import { RelationSchema, SchemaUtils } from '@forestadmin/datasource-toolkit';

import {
  CollectionCustomizer,
  DataSourceCustomizer,
  TCollectionName,
  TFieldName,
  TFieldRelation,
  TRelationName,
  TSchema,
} from '@forestadmin/datasource-customizer';

function getRelationOrThrowError<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
>(
  relationName: TRelationName<S, N>,
  collectionCustomizer: CollectionCustomizer<S, N>,
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
export default async function importFields<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
>(
  dataSourceCustomizer: DataSourceCustomizer<S>,
  collectionCustomizer: CollectionCustomizer<S, N>,
  options: {
    relationName: TRelationName<S, N>;
    include?: TFieldRelation<S, N>[];
    exclude?: TFieldRelation<S, N>[];
  },
): Promise<void> {
  const { relationName, include, exclude } = options;

  const relation = getRelationOrThrowError(relationName, collectionCustomizer);
  const foreignCollection = dataSourceCustomizer.getCollection(relation.foreignCollection as N);

  const columns =
    include?.length > 0
      ? new Set(include)
      : new Set(SchemaUtils.getColumns(foreignCollection.schema));

  if (exclude?.length > 0) {
    exclude.forEach(column => columns.delete(column));
  }

  columns.forEach(column => {
    const path = `${relationName}:${column}`;
    const supportedFormatByFrontend = `${relationName}_${column}`;
    collectionCustomizer.importField(supportedFormatByFrontend, { path: path as TFieldName<S, N> });
  });

  return this;
}
