import { BaseDataSource } from '@forestadmin/datasource-toolkit';
import { Connection } from 'mongoose';

import MongooseCollection from './collection';
import SchemaFieldsGenerator from './utils/schema-fields-generator';

export default class MongooseDatasource extends BaseDataSource<MongooseCollection> {
  private connection: Connection;

  constructor(connection: Connection) {
    super();

    if (!connection) throw new Error('Invalid (null) Mongoose instance.');

    this.connection = connection;

    this.createCollections();
  }

  protected createCollections() {
    Object.values(this.connection.models).forEach(model => {
      this.addCollection(new MongooseCollection(this, model));
    });
    SchemaFieldsGenerator.createInverseRelationships(this.collections);
  }
}
