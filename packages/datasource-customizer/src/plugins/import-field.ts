import { ColumnSchema, RecordUtils } from '@forestadmin/datasource-toolkit';

import CollectionCustomizer from '../collection-customizer';
import DataSourceCustomizer from '../datasource-customizer';
import { OperatorDefinition } from '../decorators/operators-emulate/types';
import { TCollectionName, TColumnName, TFieldName, TSchema } from '../templates';

export default async function importField<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
>(
  dataSourceCustomizer: DataSourceCustomizer<S>,
  collectionCustomizer: CollectionCustomizer<S, N>,
  options: { name: string; path: TFieldName<S, N>; readonly?: boolean },
): Promise<void> {
  const name = options.name as TColumnName<S, N>;
  const { schema } = options.path.split(':').reduce<{ collection?: string; schema?: ColumnSchema }>(
    (memo, field) => {
      const collection = dataSourceCustomizer.getCollection(memo.collection as TCollectionName<S>);
      const fieldSchema = collection.schema.fields[field];

      if (fieldSchema === undefined) {
        throw new Error(`Field ${field} not found in collection ${collection.name}`);
      }

      if (fieldSchema.type === 'Column') return { schema: fieldSchema };
      if (fieldSchema.type === 'ManyToOne' || fieldSchema.type === 'OneToOne')
        return { collection: fieldSchema.foreignCollection };
      throw new Error(`Invalid options.path: ${options.path}}`);
    },
    { collection: collectionCustomizer.name },
  );

  collectionCustomizer.addField(name, {
    columnType: schema.columnType,
    defaultValue: schema.defaultValue,
    dependencies: [options.path],
    getValues: records => records.map(r => RecordUtils.getFieldValue(r, options.path)),
    enumValues: schema.enumValues,
  });

  if (!schema.isReadOnly && !options.readonly) {
    collectionCustomizer.replaceFieldWriting(name, value => {
      const path = options.path.split(':');
      const writingPath = {};

      path.reduce((nestedPath, currentPath, index) => {
        nestedPath[currentPath] = index === path.length - 1 ? value : {};

        return nestedPath[currentPath];
      }, writingPath);

      return writingPath;
    });
  }

  if (schema.isReadOnly && options.readonly === false) {
    throw new Error(
      `Readonly option should not be false because the field "${options.path}" is not writable`,
    );
  }

  for (const operator of schema.filterOperators) {
    const handler = value => ({ field: options.path, operator, value });
    collectionCustomizer.replaceFieldOperator(name, operator, handler as OperatorDefinition<S, N>);
  }

  if (schema.isSortable) {
    collectionCustomizer.replaceFieldSorting(name, [{ field: options.path, ascending: true }]);
  }
}
