import type {
  CollectionCustomizer,
  DataSourceCustomizer,
} from '@forestadmin/datasource-customizer';

import { ColumnSchema, ColumnType, SchemaUtils } from '@forestadmin/datasource-toolkit';

import flattenColumn from '../flatten-column';

export type FlattenJsonColumnOptions = {
  columnName: string;
  columnType: { [key: string]: ColumnType };
  level?: number;
  readonly?: boolean;
  keepOriginalColumn?: boolean;
};

const getObjectDepth = (obj: object) =>
  Object(obj) === obj ? 1 + Math.max(-1, ...Object.values(obj).map(getObjectDepth)) : 0;

/**
 * Flatten a JSON column which have a composite type
 *
 * @param dataSource The dataSource customizer provided by the agent.
 * @param collection The collection customizer instance provided by the agent.
 * @param options The options of the plugin.
 * @param options.columnName The name of the json column that you want to flatten.
 * @param options.columnType A json object representing a subset of the shape of the data in
 * the json column, with keys the column names, and values either json (to flatten further)
 * or the primitive type.
 * @param options.level The maximum level of nested fields to import by default all levels. if
 * missing the default value is the level of nesting of options.columnType
 * @param options.readonly Should the imported fields be read-only?
 * @param options.keepOriginalColumn Should the original column be kept?
 *
 * @example
 * collection.use(flattenJsonColumn, {
 *  columnName: 'address',
 *  columnType: {
 *   zipCode : 'String',
 *   road: {
 *      name: 'String', number: 'Number'
 *   }
 *   city: 'String',
 *   country: 'String'
 *  },
 * });
 *
 * @example
 * collection.use(flattenJsonColumn, {
 *  columnName: 'meta',
 *  columnType: {
 *    bio: 'String',
 *    sex: 'String',
 *    sidejob: { area: 'String', job: 'String' },
 *  },
 *  readonly: true,
 *  level: 2,
 *  keepOriginalColumn: true,
 * });
 */
export default function flattenJsonColumn(
  dataSource: DataSourceCustomizer,
  collection: CollectionCustomizer,
  options?: FlattenJsonColumnOptions,
): void {
  if (!options || !options.columnName || !options.columnType) {
    throw new Error('options.columnName and options.columnType are required.');
  }

  if (!collection) throw new Error('This plugin can only be called when customizing collections.');

  const errorMessage = `'${collection.name}.${options.columnName} cannot be flattened`;
  const schema = SchemaUtils.getColumn(collection.schema, options.columnName, collection.name);

  if (schema?.columnType !== 'Json') {
    throw new Error(
      `${errorMessage}' (only available on primitive JSON column) prefer flattenColumn otherwise.`,
    );
  }

  if (!Object.keys(options.columnType).length) {
    throw new Error(
      'options.columnType must be defined as json object representing a subset of the shape of the data in the json column.',
    );
  }

  collection.use(flattenColumn, {
    columnName: options.columnName,
    columnType: options.columnType,
    readonly: options.readonly,
    level: options.level ?? getObjectDepth(options.columnType),
  });

  if (!options.keepOriginalColumn) {
    collection.removeField(options.columnName);
  }
}
