import RelaxedDataSource from '@forestadmin/datasource-customizer/dist/context/relaxed-wrappers/datasource';
import { ConnectionOptions } from '@forestadmin/datasource-sql';
import {
  Aggregation,
  Caller,
  Filter,
  PaginatedFilter,
  Projection,
  RecordData,
} from '@forestadmin/datasource-toolkit';
import { DataType } from 'sequelize';

type ValueOrPromiseOrFactory<T> = T | Promise<T> | (() => T) | (() => Promise<T>);
type RecordDataWithCollection = { collection: string; record: RecordData };

/// //////
// Schema
/// //////

export type CachedCollectionSchema = {
  name: string;
  columns: Record<string, { isPrimaryKey?: boolean; columnType: DataType }>;
};

/// //////
// Requests & responses from user functions
/// //////

export type DumpReason = {
  reason: 'startup' | 'timer';
  collections: string[];
};

export type DeltaReason = { collections: string[] } & (
  | { reason: 'startup' }
  | { reason: 'timer' }
  | { caller: Caller; reason: 'before-list'; filter: PaginatedFilter; projection: Projection }
  | { caller: Caller; reason: 'before-aggregate'; filter: Filter; aggregation: Aggregation }
  | { caller: Caller; reason: 'after-create'; records: RecordData[] }
  | { caller: Caller; reason: 'after-update'; filter: Filter; patch: RecordData }
  | { caller: Caller; reason: 'after-delete'; filter: Filter }
);

export type DeltaRequest = {
  previousDeltaState: unknown;
  cache: RelaxedDataSource;
  collections: string[];
  reasons: Array<DeltaReason & { at: Date }>;
};

export type DumpRequest = {
  previousDumpState: unknown;
  cache: RelaxedDataSource;
  collections: string[];
  reasons: Array<DumpReason & { at: Date }>;
};

export type DumpResponse =
  | { more: true; entries: RecordDataWithCollection[]; nextDumpState: unknown }
  | { more: false; entries: RecordDataWithCollection[]; nextDeltaState?: unknown };

export type DeltaResponse = {
  more: boolean;
  nextDeltaState: unknown;
  newOrUpdatedEntries: RecordDataWithCollection[];
  deletedEntries: RecordDataWithCollection[];
};

/// //////
// Options
/// //////

export type BaseOptions = {
  /** prefix that should be used when caching */
  namespace: string;

  /** URL of the cache database (default to in-memory sqlite) */
  cacheInto?: ConnectionOptions;

  /**  */
  schema?: ValueOrPromiseOrFactory<CachedCollectionSchema[]>;

  /** */
  createRecord?: (collectionName: string, record: RecordData) => Promise<RecordData>;
  updateRecord?: (collectionName: string, record: RecordData) => Promise<RecordData>;
  deleteRecord?: (collectionName: string, record: RecordData) => Promise<void>;
};

export type DumpOptions = {
  getDump: (request: DumpRequest) => Promise<DumpResponse>;
  dumpOnStartup?: boolean;
  dumpOnTimer?: number;
};

export type DeltaOptions = {
  getDelta: (request: DeltaRequest) => Promise<DeltaResponse>;
  deltaOnStartup?: boolean;
  deltaOnTimer?: number;
  deltaOnBeforeList?: boolean;
  deltaOnBeforeAggregate?: boolean;
  deltaOnAfterCreate?: boolean;
  deltaOnAfterUpdate?: boolean;
  deltaOnAfterDelete?: boolean;
};

export type CachedDataSourceOptions =
  | (BaseOptions & DumpOptions & DeltaOptions)
  | (BaseOptions & DumpOptions)
  | (BaseOptions & DeltaOptions);
