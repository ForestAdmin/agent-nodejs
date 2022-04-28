import {
  AggregateResult,
  BaseCollection,
  DataSource,
  Logger,
  RecordData,
} from '@forestadmin/datasource-toolkit';
import { Model } from 'mongoose';

import SchemaFieldsGenerator from './utils/schema-fields-generator';

export default class MongooseCollection extends BaseCollection {
  private model: Model<RecordData>;

  constructor(name: string, dataSource: DataSource, model: Model<RecordData>, logger?: Logger) {
    super(name, dataSource);
    this.model = model;
    logger('Info', 'Collection is initialized');

    this.addFields(SchemaFieldsGenerator.buildSchemaFields(model.schema.paths));
  }

  create(): Promise<RecordData[]> {
    throw new Error('Method not implemented.');
  }

  list(): Promise<RecordData[]> {
    return null;
  }

  update(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  delete(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  aggregate(): Promise<AggregateResult[]> {
    throw new Error('Method not implemented.');
  }
}
