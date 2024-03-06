import type CacheDataSourceInterface from './cache-interface/datasource';
import type { TFilter, TPaginatedFilter } from '@forestadmin/datasource-customizer';
import type { ConnectionOptions } from '@forestadmin/datasource-sql';
import type {
  Aggregation,
  Caller,
  ColumnSchemaValidation,
  Logger,
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
  validation?: ColumnSchemaValidation;
  reference?: {
    relationName: string;
    targetCollection: string;
    targetField: string;
    relationInverse?: string;
  };
};

export type Field = ArrayField | ObjectField | LeafField;

export type CollectionReplicaSchema = {
  name: string;
  fields: Record<string, Field>;
};

/// //////
// Requests & responses from user functions
/// //////

export type PullDumpReason = {
  name: 'startup' | 'schedule';
};

export type PullDeltaReason = { collection?: string; affectedCollections?: string[] } & (
  | { name: 'startup' }
  | { name: 'schedule' }
  | { name: 'before-list'; caller: Caller; filter: TPaginatedFilter; projection: Projection }
  | { name: 'before-aggregate'; caller: Caller; filter: TFilter; aggregation: Aggregation }
  | { name: 'after-create'; caller: Caller; records: RecordData[] }
  | { name: 'after-update'; caller: Caller; filter: TFilter; patch: RecordData }
  | { name: 'after-delete'; caller: Caller; filter: TFilter }
);

export type PullDeltaRequest = {
  previousDeltaState: unknown;
  cache: CacheDataSourceInterface;
  affectedCollections: string[];
  reasons: Array<PullDeltaReason & { at: Date }>;
};

export type PullDumpRequest = {
  previousDumpState: unknown;
  cache: CacheDataSourceInterface;
  reasons: Array<PullDumpReason & { at: Date }>;
};

export type PushDeltaRequest = {
  getPreviousDeltaState(): unknown;
  cache: CacheDataSourceInterface;
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

export type ReplicaDataSourceOptions = {
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
  schema?: ValueOrPromiseOrFactory<CollectionReplicaSchema[]>;
  flattenMode?: 'auto' | 'manual';
  flattenOptions?: ValueOrPromiseOrFactory<FlattenOptions>;

  /** Writing options */
  createRecordHandler?: (collectionName: string, record: RecordData) => Promise<RecordData>;
  updateRecordHandler?: (collectionName: string, record: RecordData) => Promise<void>;
  deleteRecordHandler?: (collectionName: string, record: RecordData) => Promise<void>;

  /** Push options */
  pushDeltaHandler?: (
    request: PushDeltaRequest,
    onChanges: (changes: PushDeltaResponse) => Promise<void>,
  ) => void | Promise<void>;

  /** Pull dump options */
  pullDumpHandler?: (request: PullDumpRequest) => Promise<PullDumpResponse>;
  pullDumpOnRestart?: boolean;
  pullDumpOnSchedule?: string | string[];

  /** Pull delta options */
  pullDeltaHandler?: (request: PullDeltaRequest) => Promise<PullDeltaResponse>;
  pullDeltaOnRestart?: boolean;
  pullDeltaOnSchedule?: string | string[];
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
  ReplicaDataSourceOptions,
  | 'cacheInto'
  | 'cacheNamespace'
  | 'createRecordHandler'
  | 'updateRecordHandler'
  | 'deleteRecordHandler'
  | 'pullDeltaOnBeforeAccess'
  | 'pullDeltaOnAfterWrite'
> & {
  schema?: CollectionReplicaSchema[];
  flattenSchema?: CollectionReplicaSchema[];
  flattenOptions?: { [modelName: string]: { asModels?: string[]; asFields?: string[] } };
  logger: Logger;
  source: SynchronizationSource;
};

export interface SynchronizationTarget {
  applyDump(changes: PullDumpResponse, firstPage: boolean): Promise<void>;
  applyDelta(changes: PushDeltaResponse): Promise<void>;
}

export interface SynchronizationSource {
  requestCache: CacheDataSourceInterface;

  start(target: SynchronizationTarget): Promise<void>;
  queuePullDump(reason: PullDumpReason): Promise<void>;
  queuePullDelta(reason: PullDeltaReason): Promise<void>;
}
