import { Connection } from 'mongoose';

import { BaseDataSource } from '@forestadmin/datasource-toolkit';

import MongooseCollection from './collection';
import SchemaFieldsGenerator from './utils/schema-fields-generator';

export default class MongooseDatasource extends BaseDataSource<MongooseCollection> {
  private connection: Connection = null;

  constructor(connection: Connection) {
    super();

    if (!connection) throw new Error('Invalid (null) Mongoose instance.');

    this.connection = connection;

    this.createCollections();
  }

  protected createCollections() {
    const collections = [];

    Object.entries(this.connection.models).forEach(([modelName, model]) => {
      collections.push(new MongooseCollection(modelName, this, model));
    });
    SchemaFieldsGenerator.buildRelationsInPlace(collections);

    collections.forEach(collection => this.addCollection(collection));
  }
}
