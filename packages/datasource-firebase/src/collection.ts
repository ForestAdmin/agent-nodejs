import {
  AggregateResult,
  BaseCollection,
  RecordData,
  TSchema,
} from '@forestadmin/datasource-toolkit';

export default class FirebaseCollection extends BaseCollection {
  async create(): Promise<RecordData[]> {
    throw new Error('Method not implemented.');
  }

  async list(): Promise<RecordData[]> {
    throw new Error('Method not implemented.');
  }

  async update(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async delete(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async aggregate(): Promise<AggregateResult<TSchema, string>[]> {
    throw new Error('Method not implemented.');
  }
}
