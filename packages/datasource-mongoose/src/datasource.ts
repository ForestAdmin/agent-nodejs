import { Connection } from 'mongoose';

import { BaseDataSource, Logger } from '@forestadmin/datasource-toolkit';

import MongooseCollection from './collection';

export default class MongooseDatasource extends BaseDataSource<MongooseCollection> {
  private connection: Connection = null;

  constructor(connection: Connection, logger?: Logger) {
    super();

    if (!connection) throw new Error('Invalid (null) Mongoose instance.');

    this.connection = connection;

    this.createCollections(logger);
  }

  protected createCollections(logger?: Logger) {
    Object.entries(this.connection.models).forEach(([modelName, model]) => {
      this.addCollection(new MongooseCollection(modelName, this, model, logger));
    });
  }
}
