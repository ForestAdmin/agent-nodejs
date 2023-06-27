import { ConnectionOptions } from '@forestadmin/datasource-sql';
import { RecordData } from '@forestadmin/datasource-toolkit';
import { DataType } from 'sequelize';

import {
  AfterCreateIncrementalSyncContext,
  AfterDeleteIncrementalSyncContext,
  AfterUpdateIncrementalSyncContext,
  BeforeAggregateIncrementalSyncContext,
  BeforeListIncrementalSyncContext,
  IncrementalSyncContext,
  SyncContext,
} from './decorators/incremental/context';

export type CachedCollectionSchema = {
  name: string;
  columns: Record<string, { isPrimaryKey: boolean; columnType: DataType }>;
};

type ValueOrPromiseOrFactory<T> = T | Promise<T> | (() => T) | (() => Promise<T>);

export type SynchronizeOutput = {
  more: boolean;
  newState: unknown;
  newOrUpdatedRecords: RecordData[];
  deletedRecords: RecordData[];
};

type Options = {
  /** prefix that should be used when caching */
  namespace: string;

  /** URL of the cache database (default to in-memory sqlite) */
  cacheInto?: ConnectionOptions;

  /**  */
  schema?: ValueOrPromiseOrFactory<CachedCollectionSchema[]>;

  /** */
  createRecord?: (name: string, record: RecordData) => Promise<RecordData>;
  updateRecord?: (name: string, record: RecordData) => Promise<RecordData>;
  deleteRecord?: (name: string, record: RecordData) => Promise<void>;
};

export type FullLoadOptions = Options & {
  syncStrategy: 'full-load';

  minDelayBeforeReload?: number;
  maxDelayBeforeReload?: number;

  getRecords: (context: SyncContext) => Promise<RecordData[]>;
};

export type IncrementalOptions = Options & {
  syncStrategy: 'incremental';

  loadOnStart?: (context: SyncContext) => Promise<SynchronizeOutput>;

  syncOnInterval?: (context: IncrementalSyncContext) => Promise<SynchronizeOutput>;
  syncOnBeforeList?: (context: BeforeListIncrementalSyncContext) => Promise<SynchronizeOutput>;
  syncOnBeforeAggregate?: (
    context: BeforeAggregateIncrementalSyncContext,
  ) => Promise<SynchronizeOutput>;

  syncOnAfterCreate?: (context: AfterCreateIncrementalSyncContext) => Promise<SynchronizeOutput>;
  syncOnAfterUpdate?: (context: AfterUpdateIncrementalSyncContext) => Promise<SynchronizeOutput>;
  syncOnAfterDelete?: (context: AfterDeleteIncrementalSyncContext) => Promise<SynchronizeOutput>;

  minDelayBetweenSync?: number;
  maxDelayBeforeChanges?: number;
};

export type CachedDataSourceOptions = FullLoadOptions | IncrementalOptions;
