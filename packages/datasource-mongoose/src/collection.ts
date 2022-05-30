import {
  AggregateResult,
  BaseCollection,
  DataSource,
  RecordData,
} from '@forestadmin/datasource-toolkit';
import { Model } from 'mongoose';

import SchemaFieldsGenerator from './utils/schema-fields-generator';

export default class MongooseCollection extends BaseCollection {
  private readonly model: Model<RecordData>;

  constructor(dataSource: DataSource, model: Model<RecordData>) {
    super(model.modelName, dataSource);
    this.model = model;

    this.enableCount();
    this.addFields(SchemaFieldsGenerator.buildFieldsSchema(model));
  }

  async create(): Promise<RecordData[]> {
    throw new Error('not implemented');
  }

  async list(): Promise<RecordData[]> {
    throw new Error('not implemented');
  }

  async update(): Promise<void> {
    throw new Error('not implemented');
  }

  async delete(): Promise<void> {
    throw new Error('not implemented');
  }

  async aggregate(): Promise<AggregateResult[]> {
    throw new Error('not implemented');
  }
}
