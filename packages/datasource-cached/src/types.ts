import RelaxedDataSource from '@forestadmin/datasource-customizer/dist/context/relaxed-wrappers/datasource';
import { ConnectionOptions } from '@forestadmin/datasource-sql';
import {
  Aggregation,
  Caller,
  ColumnSchema,
  Filter,
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

  /** Dump options */
  getDump?: (request: DumpRequest) => Promise<DumpResponse>;
  dumpOnStartup?: boolean;
  dumpOnTimer?: number;

  /** Delta options */
  getDelta?: (request: DeltaRequest) => Promise<DeltaResponse>;
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
  deltaAccessDelay?: number;
};

export type ResolvedOptions = Omit<
  CachedDataSourceOptions,
  'schema' | 'flattenMode' | 'flattenOptions'
> & {
  schema?: CachedCollectionSchema[];
  flattenOptions?: { [modelName: string]: { asModels?: string[]; asFields?: string[] } };
};
