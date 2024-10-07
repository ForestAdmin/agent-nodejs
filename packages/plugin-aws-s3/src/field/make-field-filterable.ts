import type { Configuration } from '../types';
import type { CollectionCustomizer } from '@forestadmin/datasource-customizer';

import { SchemaUtils } from '@forestadmin/datasource-toolkit';

export default function makeFieldFilterable(
  collection: CollectionCustomizer,
  config: Configuration,
): void {
  const schema = SchemaUtils.getColumn(collection.schema, config.sourcename, collection.name);

  for (const operator of schema.filterOperators) {
    collection.replaceFieldOperator(config.filename, operator, value => ({
      field: config.sourcename,
      operator, // @fixme not sure this works, we should use intermediary variable
      value,
    }));
  }
}
