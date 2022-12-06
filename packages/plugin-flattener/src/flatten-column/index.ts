import type {
  CollectionCustomizer,
  DataSourceCustomizer,
} from '@forestadmin/datasource-customizer';

import { makeCreateHook, makeField, makeUpdateHook, makeWriteHandler } from './customization';
import { includeStrToPath, listPaths } from './helpers';

/**
 * Flatten a column which have a composite type
 *
 * @param dataSource The dataSource customizer provided by the agent.
 * @param collection The collection customizer instance provided by the agent.
 * @param options The options of the plugin.
 * @param options.columnName The name of the column to import.
 * @param options.include The list of fields to import.
 * @param options.exclude The list of fields to exclude.
 * @param options.level The maximum level of nested fields to import.
 * @param options.readonly Should the imported fields be read-only?
 */
export default async function flattenColumn(
  dataSource: DataSourceCustomizer,
  collection: CollectionCustomizer,
  options?: {
    columnName: string;
    include?: string[];
    exclude?: string[];
    level?: number;
    readonly?: boolean;
  },
): Promise<void> {
  if (!options || !options.columnName) throw new Error('options.columnName is required.');
  if (!collection) throw new Error('This plugin can only be called when customizing collections.');

  const { columnName, include, exclude, level, readonly } = options;
  const schema = collection.schema.fields[options.columnName];
  if (schema.type !== 'Column')
    throw new Error(`'${collection.name}.${columnName}' is not a column.`);
  if (typeof schema.columnType === 'string' || Array.isArray(schema.columnType))
    throw new Error(`'${collection.name}.${columnName}' cannot be flattened.`);

  const maxLevel = include ? 6 : level ?? 1;
  if (maxLevel < 1) throw new Error('options.level must be greater than 0.');

  const paths = listPaths(columnName, schema.columnType, maxLevel)
    .filter(path => !include || include.find(p => path === includeStrToPath(columnName, p)))
    .filter(path => !exclude?.find(p => path === includeStrToPath(columnName, p)));

  if (paths.length) {
    for (const path of paths) {
      collection.addField(path, makeField(columnName, path, schema));
      collection.replaceFieldWriting(path, makeWriteHandler(path));
    }

    if (!schema.isReadOnly && !readonly) {
      collection.addHook('Before', 'Create', makeCreateHook(paths));
      collection.addHook('Before', 'Update', makeUpdateHook(collection, columnName, paths));
    }
  } else {
    throw new Error(`No fields to flatten in '${collection.name}.${columnName}'.`);
  }
}
