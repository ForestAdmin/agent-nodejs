/* eslint-disable no-await-in-loop */
import { DataSource, DataSourceDecorator } from '@forestadmin/datasource-toolkit';

import SchemaCollectionDecorator from './collection';
import { CollectionReplicaSchema, ResolvedOptions } from '../../types';

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
