import RelaxedDataSource from '@forestadmin/datasource-customizer/dist/context/relaxed-wrappers/datasource';
import { ConnectionOptions } from '@forestadmin/datasource-sql';
import {
  Aggregation,
  Caller,
  Filter,
  PaginatedFilter,
  PrimitiveTypes,
  Projection,
  RecordData,
} from '@forestadmin/datasource-toolkit';

type ValueOrPromiseOrFactory<T> = T | Promise<T> | (() => T) | (() => Promise<T>);
export type RecordDataWithCollection = { collection: string; record: RecordData };

/// //////
// Schema
/// //////

export type ObjectField = { type: 'Object'; fields: Record<string, Field> };
export type ArrayField = { type: 'Array'; items: Field };
export type LeafField = {
  type: PrimitiveTypes | 'Integer';
  defaultValue?: unknown;
  enumValues?: string[];
  isPrimaryKey?: boolean;
  isReadOnly?: boolean;
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

export type DumpReason = {
  reason: 'schema-discovery' | 'startup' | 'timer';
  collections: string[];
};

export type DeltaReason = { collections: string[] } & (
  | { reason: 'schema-discovery' }
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

  flattenOptions?: { [modelName: string]: { asModels?: string[]; asFields?: string[] } };

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
  deltaOnBeforeAccess?: boolean;
  deltaOnAfterWrite?: boolean;

  /**
   * Delay that should be waited before each cache access to give the opportunity for
   * multiple requests to be batched together.
   *
   * Note that this delay will add latency to each request, so set it to a low value (< 100ms)
   */
  accessDelay?: number;
};

export type CachedDataSourceOptions =
  | (BaseOptions & DumpOptions & DeltaOptions)
  | (BaseOptions & DumpOptions)
  | (BaseOptions & DeltaOptions);
