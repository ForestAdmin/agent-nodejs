import { BaseDataSource } from '@forestadmin/datasource-toolkit';
import { Connection } from 'mongoose';

import MongooseCollection from './collection';
import SchemaFieldsGenerator from './utils/schema-fields-generator';

export default class MongooseDatasource extends BaseDataSource<MongooseCollection> {
  private connection: Connection;

  constructor(connection: Connection, pathsToFlatten: string[] = []) {
    super();

    if (!connection) throw new Error('Invalid (null) Mongoose instance.');

    this.connection = connection;

    this.createCollections(pathsToFlatten);
  }

  protected createCollections(pathsToFlatten: string[] = []) {
    Object.values(this.connection.models).forEach(model => {
      this.addCollection(new MongooseCollection(this, model, pathsToFlatten));
    });
    SchemaFieldsGenerator.addInverseRelationships(this.collections);
  }
}
