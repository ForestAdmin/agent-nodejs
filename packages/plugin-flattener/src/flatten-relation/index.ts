import type {
  CollectionCustomizer,
  DataSourceCustomizer,
} from '@forestadmin/datasource-customizer';

import { getFields, getSchema } from './helpers';

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
    withRelations?: boolean;
  },
): Promise<void> {
  if (!options || !options.relationName) throw new Error('options.relationName is required.');
  if (!collection) throw new Error('This plugin can only be called when customizing collections.');

  const { relationName, include, exclude, readonly, withRelations } = options;
  const relationSchema = getSchema(relationName, dataSource, collection);
  if (relationSchema?.type !== 'ManyToOne' && relationSchema?.type !== 'OneToOne')
    throw new Error(`'${collection.name}.${relationName}' must be either ManyToOne or OneToOne.`);

  const relation = dataSource.getCollection(relationSchema.foreignCollection);
  let fields: Set<string>;
  if (include?.length > 0) fields = new Set(include);
  else if (withRelations) fields = getFields(relation.schema, ['Column', 'OneToOne', 'ManyToOne']);
  else fields = getFields(relation.schema, ['Column']);

  exclude?.forEach(column => fields.delete(column));

  for (const field of fields) {
    const path = `${relationName}:${field}`;
    const alias = path.replace(/:/g, '@@@');
    const schema = relation.schema.fields[field];

    if (schema?.type === 'Column') {
      collection.importField(alias, { path, readonly });
    } else if (schema?.type === 'OneToOne') {
      collection.addOneToOneRelation(alias, schema.foreignCollection, {
        originKey: schema.originKey,
        originKeyTarget: `${relationName}:${schema.originKeyTarget}`.replace(/:/g, '@@@'),
      });
    } else if (schema?.type === 'ManyToOne') {
      collection.addManyToOneRelation(alias, schema.foreignCollection, {
        foreignKey: `${relationName}:${schema.foreignKey}`.replace(/:/g, '@@@'),
        foreignKeyTarget: schema.foreignKeyTarget,
      });
    } else {
      // Note that we could also import the remaining relations and it would "work".

      // The issue is that on the frontend, the 'create' action will not work from the
      // related data view because the revert relation is not defined (and we can't define it
      // without breaking the 'create' action from the main collection view).
      throw new Error(`Field '${relation.name}.${field}' is not a column, OneToOne or ManyToOne.`);
    }
  }

  return this;
}
