import { DataSource } from '../../interfaces/collection';
import { RecordData } from '../../interfaces/record';

export type WriteHandlerContext = {
  dataSource: DataSource;
  action: 'update' | 'create';
  record: RecordData;
};

export type WriteHandlerDefinition = (
  patch?: unknown,
  context?: WriteHandlerContext,
) => Promise<RecordData | void>;
