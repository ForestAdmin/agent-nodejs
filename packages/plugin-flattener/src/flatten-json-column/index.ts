import type {
  CollectionCustomizer,
  DataSourceCustomizer,
} from '@forestadmin/datasource-customizer';

import { ColumnType } from '@forestadmin/datasource-toolkit';

import flattenColumn from '../flatten-column';

export type FlattenJsonColumnOptions = {
  columnName: string;
  columnType: { [key: string]: ColumnType };
  readonly?: boolean;
  removeOriginalColumn?: boolean;
};

/**
 * Flatten a JSON column which have a composite type
 *
 * @param dataSource The dataSource customizer provided by the agent.
 * @param collection The collection customizer instance provided by the agent.
 * @param options The options of the plugin.
 * @param options.columnName The name of the column to import.
 * @param options.columnType The type of the column to import.
 * @param options.readonly Should the imported fields be read-only?
 * @param options.removeOriginalColumn Should the original column be removed?
 */
export default async function flattenJsonColumn(
  dataSource: DataSourceCustomizer,
  collection: CollectionCustomizer,
  options?: FlattenJsonColumnOptions,
): Promise<void> {
  if (!options || !options.columnName) {
    throw new Error('options.columnName and options.columnType are required.');
  }

  if (!collection) throw new Error('This plugin can only be called when customizing collections.');

  const flattenColumnName = `${options.columnName}_flattenJsonColumn`;

  collection
    .addField(flattenColumnName, {
      columnType: options.columnType,
      dependencies: [options.columnName],
      getValues: records => records.map(r => r[options.columnName]),
    })
    .use(flattenColumn, {
      columnName: flattenColumnName,
      readonly: options.readonly,
    })
    .removeField(flattenColumnName);

  if (options.removeOriginalColumn) {
    collection.removeField(options.columnName);
  }
}
