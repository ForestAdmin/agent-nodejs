/* eslint-disable no-await-in-loop */
import { DataSource, DataSourceDecorator } from '@forestadmin/datasource-toolkit';

import SchemaCollectionDecorator from './collection';
import { CachedCollectionSchema, ResolvedOptions } from '../../types';

export default class SchemaDataSourceDecorator extends DataSourceDecorator<SchemaCollectionDecorator> {
  private readonly flatSchema: CachedCollectionSchema[];

  constructor(childDataSource: DataSource, options: ResolvedOptions) {
    super(childDataSource, SchemaCollectionDecorator);

    this.flatSchema = options.flattenSchema;
  }

  getFields(name: string): CachedCollectionSchema['fields'] {
    return this.flatSchema.find(c => c.name === name).fields;
  }
}
