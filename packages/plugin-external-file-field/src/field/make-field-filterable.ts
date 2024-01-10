import type { Configuration } from '../types';
import type { CollectionCustomizer } from '@forestadmin/datasource-customizer';
import type { ColumnSchema } from '@forestadmin/datasource-toolkit';

export default function makeFieldFilterable(
  collection: CollectionCustomizer,
  config: Configuration,
): void {
  const schema = collection.schema.fields[config.sourcename] as ColumnSchema;

  for (const operator of schema.filterOperators) {
    collection.replaceFieldOperator(config.filename, operator, value => ({
      field: config.sourcename,
      operator, // @fixme not sure this works, we should use intermediary variable
      value,
    }));
  }
}
