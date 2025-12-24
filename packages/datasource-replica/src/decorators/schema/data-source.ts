import type { CollectionReplicaSchema, ResolvedOptions } from '../../types';
import type { DataSource } from '@forestadmin/datasource-toolkit';

import { DataSourceDecorator } from '@forestadmin/datasource-toolkit';

import SchemaCollectionDecorator from './collection';

export default class SchemaDataSourceDecorator extends DataSourceDecorator<SchemaCollectionDecorator> {
  private readonly flatSchema: CollectionReplicaSchema[];

  constructor(childDataSource: DataSource, options: ResolvedOptions) {
    super(childDataSource, SchemaCollectionDecorator);

    this.flatSchema = options.flattenSchema;
  }

  getFields(name: string): CollectionReplicaSchema['fields'] {
    return this.flatSchema.find(c => c.name === name).fields;
  }
}
