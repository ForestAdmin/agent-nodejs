import type {
  CollectionCustomizer,
  DataSourceCustomizer,
} from '@forestadmin/datasource-customizer';
import type { ColumnSchema, ColumnType, RecordData } from '@forestadmin/datasource-toolkit';

function getFieldValue(object: Record<string, RecordData>, path: string): unknown {
  const parts = path.split(':');

  return parts.length === 1
    ? object[parts[0]]
    : getFieldValue(object[parts[0]], parts.slice(1).join(':'));
}

function listPaths(columnName: string, type: ColumnType, level: number): string[] {
  return level === 0 || typeof type !== 'object'
    ? [columnName]
    : Object.keys(type)
        .map(key => listPaths(`${columnName}:${key}`, type[key], level - 1))
        .flat();
}

function flattenPath(customizer: CollectionCustomizer, path: string, readonly?: boolean): void {
  const field = path.substring(0, path.indexOf(':'));
  const schema = customizer.schema.fields[field] as ColumnSchema;
  const alias = path.replace(/:/g, '@@@');

  customizer.addField(alias, {
    columnType: getFieldValue({ [field]: schema.columnType as RecordData }, path) as ColumnType,
    dependencies: [field],
    getValues: records => records.map(r => getFieldValue(r, path)),
  });

  if (!schema.isReadOnly && !readonly)
    customizer.replaceFieldWriting(alias, value => {
      const parts = path.split(':');
      const writingPath = {};

      parts.reduce((nestedPath, currentPath, index) => {
        nestedPath[currentPath] = index === parts.length - 1 ? value : {};

        return nestedPath[currentPath];
      }, writingPath);

      return writingPath;
    });
}

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

  const schema = collection.schema.fields[options.columnName] as ColumnSchema;
  const maxLevel = options.include ? 6 : options.level ?? 1;
  const paths = listPaths(options.columnName, schema.columnType, maxLevel)
    .filter(path => !options.include || options.include.includes(path))
    .filter(path => !options.exclude?.includes(path));

  for (const path of paths) {
    flattenPath(collection, path, options.readonly);
  }
}
