import type {
  CollectionCustomizer,
  DataSourceCustomizer,
} from '@forestadmin/datasource-customizer';
import type { ColumnSchema, ColumnType, RecordData } from '@forestadmin/datasource-toolkit';

function getFieldValue(object: Record<string, RecordData>, path: string): unknown {
  const parts = path.split(':');

  return path.length === 1
    ? object[parts[0]]
    : getFieldValue(object[parts[0]], parts.slice(1).join(':'));
}

function listPaths(name: string, type: ColumnType, level: number): string[] {
  return level === 0 || typeof type !== 'object'
    ? [name]
    : Object.keys(type)
        .map(key => listPaths(`${name}:${key}`, type[key], level - 1))
        .flat();
}

export default async function flattenColumn(
  dataSourceCustomizer: DataSourceCustomizer,
  collectionCustomizer: CollectionCustomizer,
  options?: {
    field: string;
    level: number;
    readonly?: boolean;
  },
): Promise<void> {
  const schema = collectionCustomizer.schema.fields[options.field] as ColumnSchema;

  collectionCustomizer.removeField(options.field);

  for (const path of listPaths(options.field, schema.columnType, options.level)) {
    const alias = path.replace(/:/g, '@@@');

    collectionCustomizer.addField(alias, {
      columnType: getFieldValue(
        { [options.field]: schema.columnType as RecordData },
        path,
      ) as ColumnType,
      dependencies: [options.field],
      getValues: records => records.map(r => getFieldValue(r, path)),
    });

    if (!schema.isReadOnly && !options.readonly) {
      collectionCustomizer.replaceFieldWriting(alias, value => {
        const parts = path.split(':');
        const writingPath = {};

        parts.reduce((nestedPath, currentPath, index) => {
          nestedPath[currentPath] = index === parts.length - 1 ? value : {};

          return nestedPath[currentPath];
        }, writingPath);

        return writingPath;
      });
    }
  }
}
