/* eslint-disable */
import { BaseDataSource, Logger } from '@forestadmin/datasource-toolkit';
import { Model } from 'dynamoose/dist/Model';

import DynamooseCollection from './collection';

export default class SequelizeDataSource extends BaseDataSource {
  constructor(models: Model<any>[], logger?: Logger) {
    super();

    for (const model of models) {
      this.addCollection(new DynamooseCollection(this, model));
    }

    void logger;
  }
}
