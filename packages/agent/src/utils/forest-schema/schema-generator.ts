import { DataSource } from '@forestadmin/datasource-toolkit';

import SchemaGeneratorCollection from './generator-collection';
import { ForestServerCollection } from './types';

export default class SchemaGenerator {
  static async generate(dataSource: DataSource): Promise<ForestServerCollection[]> {
    return Promise.all(
      dataSource.collections.map(collection => SchemaGeneratorCollection.buildSchema(collection)),
    );
  }
}
