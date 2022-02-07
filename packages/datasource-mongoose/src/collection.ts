import { Model } from 'mongoose';
import {
  AggregateResult,
  BaseCollection,
  DataSource,
  RecordData,
} from '@forestadmin/datasource-toolkit';

import SchemaFieldsGenerator from './utils/schema-fields-generator';

export default class MongooseCollection extends BaseCollection {
  private model: Model<RecordData>;

  constructor(name: string, dataSource: DataSource, model: Model<RecordData>) {
    super(name, dataSource);
    this.model = model;

    this.addFields(SchemaFieldsGenerator.buildSchemaFields(model.schema.paths));
  }

  override getById(): Promise<RecordData> {
    throw new Error('Method not implemented.');
  }

  create(): Promise<RecordData[]> {
    throw new Error('Method not implemented.');
  }

  list(): Promise<RecordData[]> {
    throw new Error('Method not implemented.');
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
