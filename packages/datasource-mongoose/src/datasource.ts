import { Connection } from 'mongoose';
import { BaseDataSource } from '@forestadmin/datasource-toolkit';

import MongooseCollection from './collection';

export default class MongooseDatasource extends BaseDataSource<MongooseCollection> {
  constructor(connection: Connection) {
    super();

    Object.entries(connection.models).forEach(([modelName, model]) => {
      this.addCollection(new MongooseCollection(modelName, this, model));
    });
  }
}
