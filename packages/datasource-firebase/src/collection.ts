import {
  AggregateResult,
  BaseCollection,
  RecordData,
  TSchema,
} from '@forestadmin/datasource-toolkit';

export default class FirebaseCollection extends BaseCollection {
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

  aggregate(): Promise<AggregateResult<TSchema, string>[]> {
    throw new Error('Method not implemented.');
  }
}
