import RelaxedDataSource from '@forestadmin/datasource-customizer/dist/context/relaxed-wrappers/datasource';
import { ConnectionOptions } from '@forestadmin/datasource-sql';
import {
  Aggregation,
  Caller,
  ColumnSchema,
  Filter,
  Logger,
  PaginatedFilter,
  PrimitiveTypes,
  Projection,
  RecordData,
} from '@forestadmin/datasource-toolkit';

export type ValueOrPromiseOrFactory<T> = T | Promise<T> | (() => T) | (() => Promise<T>);
export type RecordDataWithCollection = { collection: string; record: RecordData };

/// //////
// Schema
/// //////

export function isLeafField(field: Field): field is LeafField {
  return typeof field === 'object' && 'type' in field;
}

export type ObjectField = { [key: string]: Field };
export type ArrayField = [Field];
export type LeafField = {
  type: PrimitiveTypes | 'Integer';
  defaultValue?: unknown;
  enumValues?: string[];
  isPrimaryKey?: boolean;
  isReadOnly?: boolean;
  unique?: boolean;
  validation?: ColumnSchema['validation'];
  reference?: {
    relationName: string;
    targetCollection: string;
    targetField: string;
    relationInverse?: string;
  };
};

export type Field = ArrayField | ObjectField | LeafField;

export type CachedCollectionSchema = {
  name: string;
  fields: Record<string, Field>;
};

/// //////
// Requests & responses from user functions
/// //////

export type PullDumpReason = {
  reason: 'startup' | 'timer';
  collections: string[];
};

export type PullDeltaReason = { collections: string[] } & (
  | { reason: 'startup' }
  | { reason: 'timer' }
  | { caller: Caller; reason: 'before-list'; filter: PaginatedFilter; projection: Projection }
  | { caller: Caller; reason: 'before-aggregate'; filter: Filter; aggregation: Aggregation }
  | { caller: Caller; reason: 'after-create'; records: RecordData[] }
  | { caller: Caller; reason: 'after-update'; filter: Filter; patch: RecordData }
  | { caller: Caller; reason: 'after-delete'; filter: Filter }
);

export type PullDeltaRequest = {
  previousDeltaState: unknown;
  cache: RelaxedDataSource;
  collections: string[];
  reasons: Array<PullDeltaReason & { at: Date }>;
};

export type PullDumpRequest = {
  previousDumpState: unknown;
  cache: RelaxedDataSource;
  collections: string[];
  reasons: Array<PullDumpReason & { at: Date }>;
};

export type PushDeltaRequest = {
  previousDeltaState: unknown;
  cache: RelaxedDataSource;
};

export type PullDumpResponse =
  | { more: true; entries: RecordDataWithCollection[]; nextDumpState: unknown }
  | { more: false; entries: RecordDataWithCollection[]; nextDeltaState?: unknown };

export type PullDeltaResponse = {
  more: boolean;
  nextDeltaState: unknown;
  newOrUpdatedEntries: RecordDataWithCollection[];
  deletedEntries: RecordDataWithCollection[];
};

export type PushDeltaResponse = Omit<PullDeltaResponse, 'more' | 'nextDeltaState'> & {
  // optional nextDeltaState (leaving this undefined will keep the previous one)
  nextDeltaState?: unknown;
};

/// //////
// Options
/// //////
export type FlattenOptions = {
  [modelName: string]: {
    asModels?: string[];
    asFields?: Array<string | { field: string; level: number }>;
  };
};

export type CachedDataSourceOptions = {
  /** URL of the cache database (default to in-memory sqlite) */
  cacheInto?: ConnectionOptions;

  /**
   * Prefix that should be used when creating the tables on the cache
   * Defaults to 'forest_cache_'.
   *
   * Using a prefix allows to share the same database between multiple projects, environments, or
   * datasources.
   */
  cacheNamespace?: string;

  /** Schema options */
  schema?: ValueOrPromiseOrFactory<CachedCollectionSchema[]>;
  flattenMode?: 'auto' | 'manual' | 'none';
  flattenOptions?: ValueOrPromiseOrFactory<FlattenOptions>;

  /** Writing options */
  createRecord?: (collectionName: string, record: RecordData) => Promise<RecordData>;
  updateRecord?: (collectionName: string, record: RecordData) => Promise<RecordData>;
  deleteRecord?: (collectionName: string, record: RecordData) => Promise<void>;

  /** Push options */
  pushDeltaHandler?: (
    request: PushDeltaRequest,
    onChanges: (changes: PushDeltaResponse) => Promise<void>,
  ) => void | Promise<void>;

  /** Pull dump options */
  pullDumpHandler?: (request: PullDumpRequest) => Promise<PullDumpResponse>;
  pullDumpOnRestart?: boolean;
  pullDumpOnTimer?: number;

  /** Pull delta options */
  pullDeltaHandler?: (request: PullDeltaRequest) => Promise<PullDeltaResponse>;
  pullDeltaOnRestart?: boolean;
  pullDeltaOnTimer?: number;
  pullDeltaOnBeforeAccess?: boolean;
  pullDeltaOnAfterWrite?: boolean;

  /**
   * Delay that should be waited before each cache access to give the opportunity for
   * multiple requests to be batched together.
   *
   * Note that this delay will add latency to each request, so set it to a low value (< 100ms)
   */
  pullDeltaOnBeforeAccessDelay?: number;
};

export type ResolvedOptions = Pick<
  CachedDataSourceOptions,
  | 'cacheInto'
  | 'cacheNamespace'
  | 'createRecord'
  | 'updateRecord'
  | 'deleteRecord'
  | 'pullDeltaOnBeforeAccess'
  | 'pullDeltaOnAfterWrite'
> & {
  schema?: CachedCollectionSchema[];
  flattenSchema?: CachedCollectionSchema[];
  flattenOptions?: { [modelName: string]: { asModels?: string[]; asFields?: string[] } };
  logger: Logger;
  source: SynchronizationSource;
};

export interface SynchronizationTarget {
  applyDump(changes: PullDumpResponse, firstPage: boolean): Promise<void>;
  applyDelta(changes: PushDeltaResponse): Promise<void>;
}

export interface SynchronizationSource {
  requestCache: RelaxedDataSource;

  start(target: SynchronizationTarget): Promise<void>;
  queuePullDump(reason: PullDumpReason): Promise<void>;
  queuePullDelta(reason: PullDeltaReason): Promise<void>;
}
