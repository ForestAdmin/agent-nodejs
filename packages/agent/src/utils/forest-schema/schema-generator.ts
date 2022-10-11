import { DataSource } from '@forestadmin/datasource-toolkit';

import { ForestServerCollection } from './types';
import SchemaGeneratorCollection from './generator-collection';

export default class SchemaGenerator {
  static async generate(dataSource: DataSource): Promise<ForestServerCollection[]> {
    return Promise.all(
      dataSource.collections.map(collection => SchemaGeneratorCollection.buildSchema(collection)),
    );
  }
}
