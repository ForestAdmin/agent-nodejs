import { DataSource } from '../../interfaces/collection';
import { RecordData } from '../../interfaces/record';
import { ValueOrHandler } from '../fields';

export type WriteContext = {
  dataSource: DataSource;
  action: 'update' | 'create';
  record: RecordData;
  patch?: unknown;
};

export type WriteDefinition = ValueOrHandler<WriteContext, RecordData | void>;
