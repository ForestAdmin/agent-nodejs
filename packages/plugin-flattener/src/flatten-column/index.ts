import type {
  CollectionCustomizer,
  DataSourceCustomizer,
} from '@forestadmin/datasource-customizer';

import { ColumnSchema } from '@forestadmin/datasource-toolkit';

import { makeCreateHook, makeField, makeUpdateHook, makeWriteHandler } from './customization';
import { includeStrToPath, listPaths } from './helpers';

export type FlattenColumnOptions = {
  columnName: string;
  include?: string[];
  exclude?: string[];
  level?: number;
  readonly?: boolean;
};

function optionsToPaths(collection: CollectionCustomizer, options: FlattenColumnOptions): string[] {
  const { columnName, include, exclude, level } = options;
  const errorMessage = `'${collection.name}.${columnName}' cannot be flattened`;
  const schema = collection.schema.fields[options.columnName];

  if (!schema) throw new Error(`${errorMessage}' (not found).`);
  if (schema.type !== 'Column') throw new Error(`${errorMessage}' (not a column).`);
  if (typeof schema.columnType === 'string') throw new Error(`${errorMessage}' (primitive).`);
  if (Array.isArray(schema.columnType)) throw new Error(`${errorMessage}' (array).`);

  let paths = include?.map(p => includeStrToPath(columnName, p));

  if (!paths?.length) {
    if (level < 1) throw new Error('options.level must be greater than 0.');
    paths = listPaths(columnName, schema.columnType, level ?? 1);
  }

  paths = paths.filter(path => !exclude?.find(p => path === includeStrToPath(columnName, p)));

  if (!paths.length) throw new Error(`${errorMessage}' (no fields match level/include/exclude).`);

  return paths;
}

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
  options?: FlattenColumnOptions,
): Promise<void> {
  if (!options || !options.columnName) throw new Error('options.columnName is required.');
  if (!collection) throw new Error('This plugin can only be called when customizing collections.');

  const paths = optionsToPaths(collection, options);
  const schema = collection.schema.fields[options.columnName] as ColumnSchema;

  // Add fields that reads the value from the deeply nested column
  for (const path of paths) {
    collection.addField(path, makeField(options.columnName, path, schema));
  }

  // Implement write
  if (!schema.isReadOnly && !options.readonly) {
    // Add hooks to intercept the creation and update of the column (replaceFieldWriting would not
    // work because it is called once per field, and we need to intercept the whole patch).
    collection.addHook('Before', 'Create', makeCreateHook(paths));
    collection.addHook('Before', 'Update', makeUpdateHook(collection, options.columnName, paths));

    // They will never get called because the hooks will modify the patch, but we need them
    // so that the field is flagged as writable.
    for (const path of paths) {
      collection.replaceFieldWriting(path, makeWriteHandler(path));
    }
  }
}
