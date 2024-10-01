import type { Configuration } from '../types';
import type { CollectionCustomizer } from '@forestadmin/datasource-customizer';

import { SchemaUtils } from '@forestadmin/datasource-toolkit';

export default function makeFieldRequired(
  collection: CollectionCustomizer,
  config: Configuration,
): void {
  const schema = SchemaUtils.getColumn(collection.schema, config.sourcename, collection.name);

  if (schema.validation?.find(rule => rule.operator === 'Present')) {
    collection.addFieldValidation(config.filename, 'Present');
  }
}
