import type PaginationCache from './utils/pagination-cache';
import type { PaginationCacheOptions } from './utils/pagination-cache';
import type { DynamoDBClientConfig } from '@aws-sdk/client-dynamodb';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { AggregateResult, FieldSchema } from '@forestadmin/datasource-toolkit';

export type ScanPolicy = 'allow' | 'warn' | 'deny';

export type KeyType = 'S' | 'N';

export type KeyAttribute = { name: string; type: KeyType };

export type DynamoDataType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'dateonly'
  | 'timeonly'
  | 'object'
  | 'array'
  | 'null'
  | 'binary'
  | 'point';

export type AttributeSchema = {
  type: DynamoDataType;
  nullable?: boolean;
  /** An array stored as a string or number set, which must be written back as one. */
  set?: boolean;
  /** Schema of the items of an array of maps, used to expose it as a virtual collection. */
  items?: Record<string, AttributeSchema>;
};

export type IndexModel = {
  name: string;
  type: 'GSI' | 'LSI';
  partitionKey: KeyAttribute;
  sortKey?: KeyAttribute;
  projectsAllAttributes: boolean;
  /**
   * Whether every item of the table is in the index. An index leaves out the items that lack its
   * sort key, so it is only read without a condition on that key when this is true.
   */
  coversAllItems?: boolean;
};

/**
 * Tells which items of a table belong to a collection, so that several collections can share one
 * table (single-table design): either a discriminator attribute or a prefix of the sort key.
 */
export type EntityDefinition = { attribute?: string; value?: string; sortKeyPrefix?: string };

export type OverrideTypeConverter = (field: {
  fieldName: string;
  attribute: AttributeSchema;
  generatedFieldSchema: FieldSchema;
}) => void | FieldSchema;

export type TableModel = {
  /** Name of the collection in Forest Admin. */
  name: string;
  tableName: string;
  partitionKey: KeyAttribute;
  sortKey?: KeyAttribute;
  indexes: IndexModel[];
  /** Attributes by flattened name: nested maps are `a@@@b`. */
  schema: Record<string, AttributeSchema>;
  entity?: EntityDefinition;
  enableCount?: boolean;
  scanPolicy?: ScanPolicy;
  maxScannedItems?: number;
  overrideTypeConverter?: OverrideTypeConverter;
};

export type FieldDefinition = {
  name: string;
  type: DynamoDataType;
  nullable?: boolean;
  /** For arrays: the type of the items. */
  subType?: DynamoDataType;
  /** For arrays of strings or numbers: the attribute is a DynamoDB set, not a list. */
  set?: boolean;
  /** For objects, and arrays of objects: the nested attributes. */
  fields?: FieldDefinition[];
};

export type IndexDefinition = {
  name: string;
  type: 'GSI' | 'LSI';
  partitionKey: { name: string; type: 'string' | 'number' };
  sortKey?: { name: string; type: 'string' | 'number' };
  /** Whether the index projects every attribute, which a query on it needs. Default: true. */
  projectsAllAttributes?: boolean;
  /** Every item has the index keys, so the index may be read without a sort key condition. */
  coversAllItems?: boolean;
};

export type CollectionDefinition = {
  name: string;
  tableName: string;
  partitionKey: { name: string; type: 'string' | 'number' };
  sortKey?: { name: string; type: 'string' | 'number' };
  fields: FieldDefinition[];
  indexes?: IndexDefinition[];
  entity?: EntityDefinition;
  enableCount?: boolean;
  scanPolicy?: ScanPolicy;
  maxScannedItems?: number;
  overrideTypeConverter?: OverrideTypeConverter;
};

/** The version of the introspection this datasource reads and writes. */
export const INTROSPECTION_VERSION = 1;

/**
 * What the datasource knows of the tables: the output of `introspect` and the input of the
 * `introspection` option, which skips the live introspection. Written by hand, it is the manual schema.
 */
export type Introspection = {
  version?: typeof INTROSPECTION_VERSION;
  collections: CollectionDefinition[];
};

/** @deprecated The manual schema is an introspection. */
export type ManualSchemaConfig = Introspection;

export type VirtualCollectionConfig = {
  /** Name of the collection holding the array. */
  parentCollection: string;
  /** Name of the new collection. */
  collectionName: string;
  /** Attribute holding the array, `a@@@b` for a nested one. */
  arrayField: string;
};

export type CollectionSettings = {
  scanPolicy: ScanPolicy;
  maxScannedItems: number;
  scanConcurrency: number;
  approximateCount: boolean;
  chartCacheTtlMs: number;
  maxOffset: number;
  maxWriteRetries: number;
  writeRetryBaseDelayMs: number;
  logConsumedCapacity: boolean;
  logQueries: boolean;
  inMemoryProcessing: boolean;
  paginationCache: PaginationCache;
  /** Charts by table then by request: every collection of a table drops them on a write. */
  chartCaches: Map<string, Map<string, { at: number; value: AggregateResult[] }>>;
  now: () => number;
};

export type DynamoDBClientOptions = {
  /** An existing client, low-level or document client. When set, the options below are ignored. */
  client?: DynamoDBDocumentClient | { send: (command: never) => Promise<unknown> };
  region?: string;
  endpoint?: string;
  credentials?: DynamoDBClientConfig['credentials'];
  /** Anything else the AWS SDK client accepts. */
  clientConfig?: DynamoDBClientConfig;
};

export type DynamoDBSettingsOptions = {
  /** What happens when a request has to scan the table. Default: 'warn'. */
  scanPolicy?: ScanPolicy;
  /** Items a single request may read before it is stopped. Default: 1 000 000. */
  maxScannedItems?: number;
  /** Segments of the parallel scans run for charts. Default: 4. */
  scanConcurrency?: number;
  /** Answer an unfiltered count from the table description (refreshed about every 6 hours). */
  approximateCount?: boolean;
  /** How long a chart is served from memory, in milliseconds. 0 disables it. Default: 30 000. */
  chartCacheTtlMs?: number;
  /** Deepest page that can be requested. Default: 100 000. */
  maxOffset?: number;
  /** Log the capacity units each request consumed. */
  logConsumedCapacity?: boolean;
  /** Log the expressions sent to DynamoDB. */
  logQueries?: boolean;
  /**
   * Lets Forest filter and sort on what DynamoDB does not evaluate itself (`IContains`, `Like`,
   * relative dates, a sort on any attribute): the datasource reads the items and does it. Off by
   * default: those columns are then neither filterable that way nor sortable.
   */
  inMemoryProcessing?: boolean;
  paginationCache?: PaginationCacheOptions;
};

export type IntrospectionConfig = {
  /** Items read per table to infer its attributes. Default: 100. */
  sampleSize?: number;
  /** Deepest nested map exposed as separate attributes. Default: 5. */
  maxDepth?: number;
};
